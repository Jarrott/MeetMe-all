import { IconPhone, IconVideo } from "@douyinfe/semi-icons";
import { Toast } from "@douyinfe/semi-ui";
import React, { Component } from "react";
import { ChannelTypePerson } from "wukongimjssdk";
import ConversationContext from "../Conversation/context";
import RTCService from "../../Service/RTC";
import { RTCCallType } from "../../Messages/RTC";
import "./index.css";

interface RTCToolbarButtonProps {
  conversationContext: ConversationContext;
  callType: RTCCallType;
}

export default class RTCToolbarButton extends Component<RTCToolbarButtonProps> {
  async startCall() {
    const { conversationContext, callType } = this.props;
    const channel = conversationContext.channel();
    if (channel.channelType !== ChannelTypePerson) {
      Toast.warning("群聊音视频通话暂未开放");
      return;
    }
    try {
      await RTCService.shared.startOutgoing(channel, callType);
    } catch (err: any) {
      Toast.error(err?.message || "发起通话失败");
    }
  }

  render() {
    const { callType } = this.props;
    const Icon = (callType === "video" ? IconVideo : IconPhone) as any;
    return (
      <button
        className="wk-rtc-toolbar-button"
        type="button"
        title={callType === "video" ? "视频通话" : "语音通话"}
        onClick={() => this.startCall()}
      >
        <Icon />
      </button>
    );
  }
}
