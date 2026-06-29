import {
  IconCamera,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconVideo,
} from "@douyinfe/semi-icons";
import React, { Component, createRef } from "react";
import RTCService, { RTCCallState } from "../../Service/RTC";
import WKApp from "../../App";
import { getRTCCallType } from "../../Messages/RTC";
import "./index.css";

interface RTCCallModalState {
  call: RTCCallState;
}

export default class RTCCallModal extends Component<{}, RTCCallModalState> {
  localVideoRef = createRef<HTMLVideoElement>();
  remoteVideoRef = createRef<HTMLVideoElement>();
  remoteAudioRef = createRef<HTMLAudioElement>();

  constructor(props: {}) {
    super(props);
    this.state = { call: RTCService.shared.getState() };
  }

  componentDidMount() {
    RTCService.shared.addListener(this.onCallChange);
  }

  componentWillUnmount() {
    RTCService.shared.removeListener(this.onCallChange);
  }

  componentDidUpdate() {
    this.attachMedia();
  }

  onCallChange = (call: RTCCallState) => {
    this.setState({ call }, () => this.attachMedia());
  };

  attachMedia() {
    RTCService.shared.attachMedia(
      this.localVideoRef.current,
      this.remoteVideoRef.current,
      this.remoteAudioRef.current
    );
  }

  renderVideoBody() {
    const { call } = this.state;
    const callType = getRTCCallType(call.payload);
    const peerName = call.payload?.from_name || call.payload?.to_name || "对方";
    if (callType !== "video") {
      return (
        <div className="wk-rtc-audio-stage">
          <img
            className="wk-rtc-peer-avatar"
            alt=""
            src={WKApp.shared.avatarUser(call.payload?.from_uid || call.payload?.to_uid || "")}
          />
          <div className="wk-rtc-peer-name">{peerName}</div>
          <div className="wk-rtc-status">{call.message || "语音通话"}</div>
        </div>
      );
    }
    return (
      <div className="wk-rtc-video-stage">
        <video ref={this.remoteVideoRef} className="wk-rtc-remote-video" autoPlay playsInline />
        {!call.remoteReady ? (
          <div className="wk-rtc-video-placeholder">
            <IconVideo />
            <span>{call.message || "等待对方接听"}</span>
          </div>
        ) : null}
        <video ref={this.localVideoRef} className="wk-rtc-local-video" autoPlay playsInline muted />
      </div>
    );
  }

  renderActions() {
    const { call } = this.state;
    const isRinging = call.status === "ringing";
    const MicIcon = (call.muted ? IconMicrophoneOff : IconMicrophone) as any;
    const callType = getRTCCallType(call.payload);

    if (isRinging) {
      return (
        <div className="wk-rtc-actions">
          <button className="wk-rtc-action danger" type="button" onClick={() => RTCService.shared.rejectIncoming()}>
            拒绝
          </button>
          <button className="wk-rtc-action accept" type="button" onClick={() => RTCService.shared.acceptIncoming()}>
            接听
          </button>
        </div>
      );
    }

    return (
      <div className="wk-rtc-actions">
        <button className="wk-rtc-icon-action" type="button" title="麦克风" onClick={() => RTCService.shared.toggleMute()}>
          <MicIcon />
        </button>
        {callType === "video" ? (
          <button className="wk-rtc-icon-action" type="button" title="摄像头" onClick={() => RTCService.shared.toggleCamera()}>
            <IconCamera />
          </button>
        ) : null}
        <button className="wk-rtc-icon-action danger" type="button" title="挂断" onClick={() => RTCService.shared.hangup()}>
          <IconPhone />
        </button>
      </div>
    );
  }

  render() {
    const { call } = this.state;
    if (call.status === "idle") {
      return null;
    }
    const callType = getRTCCallType(call.payload);
    const title = callType === "video" ? "视频通话" : "语音通话";
    return (
      <div className="wk-rtc-modal">
        <div className="wk-rtc-card">
          <div className="wk-rtc-header">
            <span>{title}</span>
            <span className={`wk-rtc-state ${call.status}`}>{call.message || ""}</span>
          </div>
          {this.renderVideoBody()}
          <audio ref={this.remoteAudioRef} autoPlay />
          {call.status !== "ended" && call.status !== "error" ? this.renderActions() : null}
        </div>
      </div>
    );
  }
}
