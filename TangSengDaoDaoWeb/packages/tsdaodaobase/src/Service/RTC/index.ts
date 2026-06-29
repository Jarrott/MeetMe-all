import {
  LocalTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
} from "livekit-client";
import {
  Channel,
  ChannelTypePerson,
  Message,
  Setting,
  WKSDK,
} from "wukongimjssdk";
import WKApp from "../../App";
import { MessageContentTypeConst } from "../Const";
import {
  RTCCommand,
  RTCContent,
  RTCCallType,
  RTCPayload,
  extractRTCContent,
  getRTCCallType,
} from "../../Messages/RTC";

export type RTCCallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export interface RTCCallState {
  status: RTCCallStatus;
  callType: RTCCallType;
  channel?: Channel;
  payload?: RTCPayload;
  message?: string;
  muted: boolean;
  cameraOff: boolean;
  remoteReady: boolean;
  startedAt?: number;
}

type Listener = (state: RTCCallState) => void;

const emptyState = (): RTCCallState => ({
  status: "idle",
  callType: "audio",
  muted: false,
  cameraOff: false,
  remoteReady: false,
});

const newCallID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().toUpperCase();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`.toUpperCase();
};

export default class RTCService {
  static shared = new RTCService();

  private listeners: Listener[] = [];
  private state: RTCCallState = emptyState();
  private room?: Room;
  private localTracks: LocalTrack[] = [];
  private remoteVideoTrack?: RemoteTrack;
  private remoteAudioTrack?: RemoteTrack;
  private lastConfig?: { enabled: boolean; ws_url: string; token_ttl?: number };
  private finishing = false;

  addListener(listener: Listener) {
    this.listeners.push(listener);
    listener(this.state);
  }

  removeListener(listener: Listener) {
    this.listeners = this.listeners.filter((item) => item !== listener);
  }

  getState() {
    return this.state;
  }

  private setState(partial: Partial<RTCCallState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private ensurePersonChannel(channel: Channel) {
    if (channel.channelType !== ChannelTypePerson) {
      throw new Error("暂时只支持单聊音视频通话");
    }
  }

  private async getRTCConfig() {
    if (this.lastConfig?.enabled && this.lastConfig.ws_url) {
      return this.lastConfig;
    }
    const config = await WKApp.apiClient.get("rtc/config");
    if (!config?.enabled || !config?.ws_url) {
      throw new Error("RTC 服务没有开启");
    }
    this.lastConfig = config;
    return config;
  }

  private buildPayload(channel: Channel, callType: RTCCallType): RTCPayload {
    const callID = newCallID();
    const fromUID = WKApp.loginInfo.uid || "";
    const roomName = this.buildRoomName(fromUID, channel.channelID);
    return {
      call_id: callID,
      call_type: callType,
      call_type_value: callType === "video" ? 1 : 0,
      channel_id: channel.channelID,
      channel_type: channel.channelType,
      from_uid: fromUID,
      from_name: WKApp.loginInfo.name || "",
      to_uid: channel.channelID,
      room_name: roomName,
      platform: "web",
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  private buildRoomName(uidA?: string, uidB?: string) {
    const members = [uidA || "", uidB || ""].sort();
    return `p2p_${members[0]}_${members[1]}`;
  }

  private peerUID(channel: Channel, payload?: RTCPayload) {
    const loginUID = WKApp.loginInfo.uid || "";
    if (channel.channelID) {
      return channel.channelID;
    }
    if (payload?.from_uid && payload.from_uid !== loginUID) {
      return payload.from_uid;
    }
    if (payload?.to_uid && payload.to_uid !== loginUID) {
      return payload.to_uid;
    }
    return payload?.channel_id || "";
  }

  private normalizeOutgoingPayload(channel: Channel, payload: RTCPayload): RTCPayload {
    const fromUID = WKApp.loginInfo.uid || "";
    const toUID = this.peerUID(channel, payload);
    const callType = getRTCCallType(payload);
    return {
      ...payload,
      call_type: callType,
      call_type_value: callType === "video" ? 1 : 0,
      channel_id: toUID,
      channel_type: channel.channelType,
      from_uid: fromUID,
      from_name: WKApp.loginInfo.name || payload.from_name || "",
      to_uid: toUID,
      room_name: payload.room_name || this.buildRoomName(fromUID, toUID),
      platform: "web",
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  private sameCall(payload?: RTCPayload) {
    if (!payload?.call_id || !this.state.payload?.call_id) {
      return false;
    }
    return payload.call_id === this.state.payload.call_id;
  }

  private async sendSignal(channel: Channel, cmd: RTCCommand, payload: RTCPayload) {
    const content = new RTCContent(cmd, this.normalizeOutgoingPayload(channel, payload), MessageContentTypeConst.rtcP2P);
    const setting = new Setting();
    return WKSDK.shared().chatManager.send(content, channel, setting);
  }

  async startOutgoing(channel: Channel, callType: RTCCallType) {
    this.ensurePersonChannel(channel);
    if (this.state.status !== "idle" && this.state.status !== "ended" && this.state.status !== "error") {
      throw new Error("当前已有通话正在进行");
    }
    await this.getRTCConfig();
    const payload = this.buildPayload(channel, callType);
    this.setState({
      status: "calling",
      callType,
      channel,
      payload,
      muted: false,
      cameraOff: false,
      remoteReady: false,
      message: "正在呼叫...",
    });
    try {
      await this.sendSignal(channel, "rtc.p2p.invoke", payload);
      await this.connectRoom(payload, callType, "calling");
    } catch (err: any) {
      this.finishLocal(err?.message || "通话连接失败", "error");
      throw err;
    }
  }

  async acceptIncoming() {
    const { channel, payload } = this.state;
    if (!channel || !payload) {
      return;
    }
    const callType = getRTCCallType(payload);
    try {
      await this.sendSignal(channel, "rtc.p2p.accept", payload);
      this.setState({ status: "connecting", message: "正在接通...", callType });
      await this.connectRoom(payload, callType, "connecting");
    } catch (err: any) {
      this.finishLocal(err?.message || "通话连接失败", "error");
      throw err;
    }
  }

  async rejectIncoming() {
    const { channel, payload } = this.state;
    if (channel && payload) {
      await this.sendSignal(channel, "rtc.p2p.refuse", payload);
    }
    this.finishLocal("已拒绝");
  }

  async hangup() {
    const { channel, payload, status } = this.state;
    if (channel && payload) {
      const cmd: RTCCommand = status === "calling" ? "rtc.p2p.cancel" : "rtc.p2p.hangup";
      const duration = this.state.startedAt ? Math.max(0, Math.floor((Date.now() - this.state.startedAt) / 1000)) : 0;
      await this.sendSignal(channel, cmd, { ...payload, duration });
    }
    this.finishLocal("通话已结束");
  }

  toggleMute() {
    const nextMuted = !this.state.muted;
    this.localTracks.forEach((track) => {
      if ((track as any).kind === Track.Kind.Audio) {
        if (nextMuted) {
          track.mute();
        } else {
          track.unmute();
        }
      }
    });
    this.setState({ muted: nextMuted });
  }

  toggleCamera() {
    const nextCameraOff = !this.state.cameraOff;
    this.localTracks.forEach((track) => {
      if ((track as any).kind === Track.Kind.Video) {
        if (nextCameraOff) {
          track.mute();
        } else {
          track.unmute();
        }
      }
    });
    this.setState({ cameraOff: nextCameraOff });
  }

  attachMedia(localVideo?: HTMLVideoElement | null, remoteVideo?: HTMLVideoElement | null, remoteAudio?: HTMLAudioElement | null) {
    const localVideoTrack = this.localTracks.find((track) => (track as any).kind === Track.Kind.Video);
    if (localVideo && localVideoTrack) {
      localVideo.muted = true;
      localVideo.playsInline = true;
      localVideoTrack.attach(localVideo);
    }
    if (remoteVideo && this.remoteVideoTrack) {
      remoteVideo.playsInline = true;
      this.remoteVideoTrack.attach(remoteVideo);
    }
    if (remoteAudio && this.remoteAudioTrack) {
      this.remoteAudioTrack.attach(remoteAudio);
      remoteAudio.play?.().catch(() => undefined);
    }
  }

  handleSignalMessage(message: Message) {
    const rtcContent = extractRTCContent(message.content);
    if (!rtcContent) {
      return;
    }
    const payload = rtcContent.param || {};
    const loginUID = WKApp.loginInfo.uid || "";
    const signalSenderUID = message.fromUID || payload.from_uid || "";
    const toUID = payload.to_uid || payload.channel_id;
    const isFromMe = signalSenderUID === loginUID;
    const isForMe = toUID === loginUID || message.channel.channelID === signalSenderUID;

    if (rtcContent.cmd === "rtc.p2p.invoke") {
      if (!isFromMe && isForMe) {
        this.setState({
          status: "ringing",
          callType: getRTCCallType(payload),
          channel: message.channel,
          payload,
          muted: false,
          cameraOff: false,
          remoteReady: false,
          message: "邀请你通话",
        });
      }
      return;
    }

    if (!this.sameCall(payload)) {
      return;
    }

    if (rtcContent.cmd === "rtc.p2p.accept" && !isFromMe) {
      this.setState({ status: "connected", message: "通话中", startedAt: Date.now() });
      return;
    }

    if (
      rtcContent.cmd === "rtc.p2p.refuse" ||
      rtcContent.cmd === "rtc.p2p.cancel" ||
      rtcContent.cmd === "rtc.p2p.hangup" ||
      rtcContent.cmd === "rtc.p2p.missed"
    ) {
      if (!isFromMe) {
        this.finishLocal(rtcContent.conversationDigest);
      }
    }
  }

  private async connectRoom(payload: RTCPayload, callType: RTCCallType, waitingStatus: RTCCallStatus) {
    const config = await this.getRTCConfig();
    this.setState({ status: "connecting", message: "正在连接..." });
    const tokenResp = await WKApp.apiClient.post("rtc/token", {
      room: payload.room_name,
      name: WKApp.loginInfo.name || "",
      attributes: {
        scene: "chat-call",
        call_id: payload.call_id,
        call_type: callType,
      },
    });

    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, this.onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, () => {
      if (!this.finishing && (this.state.status === "connected" || this.state.status === "connecting" || this.state.status === "calling")) {
        this.finishLocal("通话已断开");
      }
    });

    await room.connect(tokenResp.ws_url || config.ws_url, tokenResp.token);
    this.localTracks = await createLocalTracks({
      audio: true,
      video: callType === "video",
    });
    for (const track of this.localTracks) {
      await room.localParticipant.publishTrack(track);
    }
    const hasRemote = room.remoteParticipants.size > 0;
    this.setState({
      status: hasRemote ? "connected" : waitingStatus,
      message: hasRemote ? "通话中" : this.state.message,
      remoteReady: hasRemote,
      startedAt: hasRemote ? Date.now() : this.state.startedAt,
    });
  }

  private onTrackSubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    _participant: RemoteParticipant
  ) => {
    if ((track as any).kind === Track.Kind.Video) {
      this.remoteVideoTrack = track;
    } else if ((track as any).kind === Track.Kind.Audio) {
      this.remoteAudioTrack = track;
    }
    this.setState({
      status: "connected",
      message: "通话中",
      remoteReady: true,
      startedAt: this.state.startedAt || Date.now(),
    });
  };

  private onTrackUnsubscribed = (track: RemoteTrack) => {
    track.detach();
    if (this.remoteVideoTrack === track) {
      this.remoteVideoTrack = undefined;
    }
    if (this.remoteAudioTrack === track) {
      this.remoteAudioTrack = undefined;
    }
  };

  private onParticipantConnected = () => {
    this.setState({
      status: "connected",
      message: "通话中",
      remoteReady: true,
      startedAt: this.state.startedAt || Date.now(),
    });
  };

  private onParticipantDisconnected = () => {
    this.setState({ remoteReady: false, message: "对方已离开" });
  };

  private finishLocal(message?: string, status: RTCCallStatus = "ended") {
    if (this.finishing) {
      return;
    }
    this.finishing = true;
    this.disconnectRoom();
    this.setState({
      ...emptyState(),
      status,
      message,
      payload: this.state.payload,
      channel: this.state.channel,
      callType: this.state.callType,
    });
    this.finishing = false;
    window.setTimeout(() => {
      if (this.state.status === "ended" || this.state.status === "error") {
        this.setState(emptyState());
      }
    }, 1400);
  }

  private disconnectRoom() {
    this.localTracks.forEach((track) => {
      track.stop();
      track.detach();
    });
    this.localTracks = [];
    if (this.remoteAudioTrack) {
      this.remoteAudioTrack.detach();
    }
    if (this.remoteVideoTrack) {
      this.remoteVideoTrack.detach();
    }
    this.remoteAudioTrack = undefined;
    this.remoteVideoTrack = undefined;
    if (this.room) {
      this.room.disconnect();
      this.room = undefined;
    }
  }
}
