import { IconPhone, IconVideo } from "@douyinfe/semi-icons";
import React from "react";
import { MessageContent } from "wukongimjssdk";
import MessageBase from "../Base";
import MessageTrail from "../Base/tail";
import { MessageBaseCellProps, MessageCell } from "../MessageCell";
import { MessageContentTypeConst } from "../../Service/Const";
import "./index.css";

export type RTCCallType = "audio" | "video";
export type RTCCommand =
  | "rtc.p2p.invoke"
  | "rtc.p2p.accept"
  | "rtc.p2p.hangup"
  | "rtc.p2p.refuse"
  | "rtc.p2p.cancel"
  | "rtc.p2p.missed"
  | "rtc.p2p.switch.video"
  | "rtc.p2p.switch.audio";

export interface RTCPayload {
  call_id?: string;
  call_type?: RTCCallType | string;
  call_type_value?: number;
  channel_id?: string;
  channel_type?: number;
  from_uid?: string;
  from_name?: string;
  to_uid?: string;
  room_name?: string;
  platform?: string;
  timestamp?: number;
  duration?: number;
  [key: string]: any;
}

const rtcTypeToCommand = (contentType: number): RTCCommand => {
  switch (contentType) {
    case MessageContentTypeConst.rtcAccept:
      return "rtc.p2p.accept";
    case MessageContentTypeConst.rtcHangup:
    case MessageContentTypeConst.rtcResult:
      return "rtc.p2p.hangup";
    case MessageContentTypeConst.rtcRefue:
      return "rtc.p2p.refuse";
    case MessageContentTypeConst.rtcCancel:
      return "rtc.p2p.cancel";
    case MessageContentTypeConst.rtcMissed:
      return "rtc.p2p.missed";
    case MessageContentTypeConst.rtcSwitchToVideo:
    case MessageContentTypeConst.rtcSwitchToVideoReply:
      return "rtc.p2p.switch.video";
    case MessageContentTypeConst.rtcSwitchToAudio:
      return "rtc.p2p.switch.audio";
    default:
      return "rtc.p2p.invoke";
  }
};

export const getRTCCallType = (payload?: RTCPayload): RTCCallType => {
  if (!payload) {
    return "audio";
  }
  if (payload.call_type === "video" || Number(payload.call_type_value) === 1) {
    return "video";
  }
  return "audio";
};

export const getRTCDigest = (cmd?: string, payload?: RTCPayload) => {
  const callName = getRTCCallType(payload) === "video" ? "视频通话" : "语音通话";
  switch (cmd) {
    case "rtc.p2p.invoke":
      return `发起${callName}`;
    case "rtc.p2p.accept":
      return `已接通${callName}`;
    case "rtc.p2p.hangup":
      return `${callName}已结束`;
    case "rtc.p2p.refuse":
      return `已拒绝${callName}`;
    case "rtc.p2p.cancel":
      return `已取消${callName}`;
    case "rtc.p2p.missed":
      return `未接听${callName}`;
    case "rtc.p2p.switch.video":
      return "切换为视频通话";
    case "rtc.p2p.switch.audio":
      return "切换为语音通话";
    default:
      return "通话消息";
  }
};

export class RTCContent extends MessageContent {
  cmd: RTCCommand | string = "";
  param: RTCPayload = {};
  private rtcContentType = MessageContentTypeConst.rtcP2P;

  constructor(cmd?: RTCCommand | string, param?: RTCPayload, contentType?: number) {
    super();
    if (cmd) {
      this.cmd = cmd;
    }
    if (param) {
      this.param = param;
    }
    if (contentType) {
      this.rtcContentType = contentType;
    }
  }

  get contentType() {
    return this.rtcContentType;
  }

  set contentType(value: number) {
    this.rtcContentType = value || MessageContentTypeConst.rtcP2P;
  }

  decodeJSON(content: any) {
    this.rtcContentType = content.type || this.rtcContentType;
    this.cmd = content.cmd || content.rtc_cmd || rtcTypeToCommand(this.rtcContentType);
    this.param = content.param || content.data || {};
    if (!this.param.call_type && content.call_type) {
      this.param = content;
    }
  }

  encodeJSON() {
    return {
      cmd: this.cmd || rtcTypeToCommand(this.rtcContentType),
      param: this.param || {},
    };
  }

  get conversationDigest() {
    return getRTCDigest(this.cmd, this.param);
  }
}

export const extractRTCContent = (content: any): RTCContent | undefined => {
  if (content instanceof RTCContent) {
    return content;
  }
  const contentObj = content?.contentObj || content;
  if (!contentObj) {
    return undefined;
  }
  const type = Number(contentObj.type || 0);
  const isRTCType =
    type === MessageContentTypeConst.rtcP2P ||
    (type >= MessageContentTypeConst.rtcResult &&
      type <= MessageContentTypeConst.rtcHangup);
  if (!isRTCType && !contentObj.cmd?.startsWith?.("rtc.")) {
    return undefined;
  }
  const rtcContent = new RTCContent(undefined, undefined, type || MessageContentTypeConst.rtcP2P);
  rtcContent.decodeJSON(contentObj);
  return rtcContent;
};

const formatDuration = (duration?: number) => {
  const total = Number(duration || 0);
  if (total <= 0) {
    return "";
  }
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

export class RTCCell extends MessageCell<MessageBaseCellProps> {
  render() {
    const { message, context } = this.props;
    const content = extractRTCContent(message.content) || (message.content as RTCContent);
    const callType = getRTCCallType(content?.param);
    const Icon = (callType === "video" ? IconVideo : IconPhone) as any;
    const duration = formatDuration(content?.param?.duration);

    return (
      <MessageBase context={context} message={message}>
        <div className="wk-message-rtc">
          <span className="wk-message-rtc-icon">
            <Icon />
          </span>
          <span className="wk-message-rtc-main">
            <span className="wk-message-rtc-title">
              {getRTCDigest(content?.cmd, content?.param)}
            </span>
            {duration ? <span className="wk-message-rtc-duration">{duration}</span> : null}
          </span>
          <MessageTrail message={message} />
        </div>
      </MessageBase>
    );
  }
}
