import WKSDK from "wukongimjssdk";
import { ChannelInfoListener } from "wukongimjssdk";
import { Channel, ChannelInfo, ChannelTypePerson, MessageStatus } from "wukongimjssdk";
import { Component, CSSProperties, HTMLProps } from "react";
import './index.css'
import { BubblePosition, MessageWrap } from "../../Service/Model";
import ConversationContext from "../../Components/Conversation/context";
import React from "react";
import { MessageContentTypeConst, MessageReasonCode } from "../../Service/Const";
import { IConversationProvider } from "../../Service/DataSource/DataProvider";
import WKApp from "../../App";
import { css } from "@emotion/react";
// import ClockLoader from "react-spinners/ClockLoader";
import Checkbox from "../../Components/Checkbox";
import classNames from "classnames";
import { Modal, Popconfirm } from "@douyinfe/semi-ui";

interface MessageBaseProps extends HTMLProps<any>{
    message: MessageWrap
    context: ConversationContext
    hiddenStatus?: boolean
    bubbleStyle?: CSSProperties
    hiddeBubble?: boolean
    onBubble?: () => void
}

export default class MessageBase extends Component<MessageBaseProps, any> {
    channelInfoListener!: ChannelInfoListener
    conversationProvider: IConversationProvider

    constructor(props: any) {
        super(props)
        this.conversationProvider = WKApp.conversationProvider
    }
    componentDidMount() {
        const self = this
        this.channelInfoListener = (channelInfo: ChannelInfo) => {
            if (!channelInfo) {
                return
            }
            const { message } = self.props
            if (message.fromUID === channelInfo.channel.channelID) {
                self.setState({})
            }

        }
        WKSDK.shared().channelManager.addListener(this.channelInfoListener)
    }

    componentWillUnmount() {
        WKSDK.shared().channelManager.removeListener(this.channelInfoListener)
    }

    // 消息是否连续的
    isContinue(): boolean {
        const { message } = this.props
        if (message.preMessage) {
            if (message.fromUID === message.preMessage.fromUID) {
                return true
            }
        }
        return false
    }

    getMessageStyle(hasContinue: boolean, message: MessageWrap) {
        const messageStyle: any = {}
        messageStyle.marginBottom = "15px"
        if (hasContinue && message.send) {
            messageStyle.marginTop = "5px"
            messageStyle.marginBottom = "0px"
            messageStyle.marginLeft = "0px"
            messageStyle.marginRight = "5px"
        }
        if (hasContinue && !message.send) {
            messageStyle.marginTop = "5px"
            messageStyle.marginBottom = "0px"
            messageStyle.marginRight = "0px"
            messageStyle.marginLeft = "15px"
        }
        if (message.preMessage && message.preMessage.fromUID !== message.fromUID) {
            if (message.nextMessage && message.nextMessage.fromUID === message.fromUID) {
                messageStyle.marginBottom = "0px"
            }
        }
        if (message.nextMessage && message.nextMessage.fromUID !== message.fromUID) {
            messageStyle.marginBottom = "15px"
        }
        return messageStyle

    }

    getBubbleRadius(hasContinue: boolean, message: MessageWrap): string {
        if (message.send) {
            return "20px 4px 8px 20px"
        }
        if (hasContinue && message.nextMessage && message.nextMessage.fromUID === message.fromUID) {
            return "8px 20px 20px 8px"
        }
        if (hasContinue && message.nextMessage && message.nextMessage.fromUID !== message.fromUID) {
            return "8px 20px 20px 8px"
        }
        return "8px 20px 20px"
    }

    getBubbleStyle() {
        const { bubbleStyle, message } = this.props
        let newBubbleStyle = bubbleStyle
        const hasContinue = this.isContinue()
        if (!newBubbleStyle) {
            newBubbleStyle = {}
        }
        newBubbleStyle.borderRadius = this.getBubbleRadius(hasContinue, message)
        console.log(newBubbleStyle)
        return newBubbleStyle
    }

 

    onMessageRevoke() {
        const { message } = this.props
        this.conversationProvider.revokeMessage(message.message)
    }
    onMultiple() {
        const { context } = this.props
        context.setEditOn(true)
    }

    onMessageDelete() {
        const { context, message } = this.props
        context.deleteMessages([message.message])
    }


    getBubbleBoxClassName() {
        const { message, hiddeBubble } = this.props
        let messageBubble = "wk-message-base-bubble-box"

        if (hiddeBubble) {
            messageBubble += " hide"
        }
        if (message.contentType === MessageContentTypeConst.file) {
            messageBubble += " fileBox"
        }
        if (message.send) {
            messageBubble += " send"
        } else {
            messageBubble += " recv"
        }
        if (message.bubblePosition === BubblePosition.first) {
            messageBubble += " first"
        } else if (message.bubblePosition === BubblePosition.middle) {
            messageBubble += " middle"
        } else if (message.bubblePosition === BubblePosition.last) {
            messageBubble += " last"
        } else if (message.bubblePosition === BubblePosition.single) {
            messageBubble += " single"
        }
        return messageBubble
    }

    needAvatar() {
        const { message } = this.props
        if (message.send) {
            return false
        }
        const channelInfo = WKSDK.shared().channelManager.getChannelInfo(new Channel(message.fromUID, ChannelTypePerson))
        return (message.bubblePosition === BubblePosition.last || message.bubblePosition === BubblePosition.single) && channelInfo
    }

    getMessageErrorReason() {
        const { message } = this.props
        switch (message.reasonCode) {
            case MessageReasonCode.reasonSubscriberNotExist:
                return "您已被踢出群聊。"
            case MessageReasonCode.reasonNotAllowSend:
            case MessageReasonCode.reasonNotInWhitelist:
            case MessageReasonCode.reasonInBlacklist:
                return "你已被禁言或全员禁言"
            case MessageReasonCode.reasonSystemError:
                return "系统错误"
        }

    }

    renderReactions() {
        const { message } = this.props
        const reactions = ((message.message as any).reactions || []) as any[]
        if (!reactions || reactions.length === 0) {
            return null
        }
        const reactionMap = new Map<string, { emoji: string, count: number, active: boolean, names: string[], users: any[] }>()
        reactions.forEach((reaction) => {
            if (!reaction || Number(reaction.isDeleted) === 1) {
                return
            }
            const emoji = reaction.emoji || "👍"
            const item = reactionMap.get(emoji) || { emoji, count: 0, active: false, names: [], users: [] }
            item.count += 1
            if (reaction.name) {
                item.names.push(reaction.name)
            }
            if (reaction.uid && !item.users.some((user) => user.uid === reaction.uid)) {
                item.users.push({
                    uid: reaction.uid,
                    name: reaction.name || "",
                })
            }
            if (reaction.uid === WKApp.loginInfo.uid) {
                item.active = true
            }
            reactionMap.set(emoji, item)
        })
        const reactionItems = Array.from(reactionMap.values())
        if (reactionItems.length === 0) {
            return null
        }
        const effectAt = (message.message as any).reactionEffectAt || 0
        return <div className="wk-message-reactions">
            {
                reactionItems.map((item) => {
                    return <span key={`${item.emoji}-${item.count}-${effectAt}`} title={item.names.join("、")} className={classNames("wk-message-reaction-pill", item.active ? "active" : undefined, item.active && effectAt > 0 ? "wk-message-reaction-pop" : undefined)} onClick={(event) => {
                        event.stopPropagation()
                        this.setState({ reactionDetail: item })
                    }}>
                        <span className="wk-message-reaction-avatars">
                            {
                                item.users.slice(0, 3).map((user) => {
                                    return <img key={user.uid} className="wk-message-reaction-avatar" alt={user.name} src={WKApp.shared.avatarUser(user.uid)} />
                                })
                            }
                        </span>
                        <span className="wk-message-reaction-emoji">{item.emoji}</span>
                        <span className="wk-message-reaction-count">{item.count}</span>
                    </span>
                })
            }
        </div>
    }
    renderReactionDetail() {
        const reactionDetail = this.state?.reactionDetail
        if (!reactionDetail) {
            return null
        }
        return <Modal title={`${reactionDetail.emoji} ${reactionDetail.count} 人点赞`} visible={!!reactionDetail} footer={null} onCancel={() => {
            this.setState({ reactionDetail: undefined })
        }}>
            <div className="wk-message-reaction-user-list">
                {
                    reactionDetail.users.map((user: any) => {
                        return <div key={user.uid} className="wk-message-reaction-user">
                            <img alt="" src={WKApp.shared.avatarUser(user.uid)} />
                            <span>{user.name || user.uid}</span>
                        </div>
                    })
                }
            </div>
        </Modal>
    }

    render() {
        const { message, context, hiddeBubble, bubbleStyle } = this.props
        const hasContinue = this.isContinue()
        const channelInfo = WKSDK.shared().channelManager.getChannelInfo(new Channel(message.fromUID, ChannelTypePerson))
        if (!channelInfo && message.fromUID && message.fromUID !== "") {
            WKSDK.shared().channelManager.fetchChannelInfo(new Channel(message.fromUID, ChannelTypePerson))
        }
        const messageStyle = this.getMessageStyle(hasContinue, message)

        return (
            <div className={classNames("wk-message-base", context.editOn() ? "wk-message-base-check-open" : undefined)} onClick={context.editOn() ? (event) => {
                context.checkeMessage(message.message, !message.checked)
            } : undefined}>
                <div className="wk-message-base-checkBox" style={{ "marginBottom": messageStyle.marginBottom }}>
                    <Checkbox checked={message.checked} />
                </div>
                <div className={message.send ? "wk-message-base-send" : "wk-message-base-recv"} style={messageStyle}>

                    <div className={"wk-message-base-box"} style={{ "pointerEvents": context.editOn() ? "none" : undefined }}>
                        {
                            message.send && message.status === MessageStatus.Fail ? (
                                <Popconfirm title="是否重新发送" okText="是" cancelText="否" onConfirm={() => {
                                    context.resendMessage(message.message)
                                }}>
                                    <div className="messageFail">
                                        <img src={require("./msg_status_fail.png")} alt=""></img>
                                    </div>
                                </Popconfirm>
                            ) : undefined
                        }

                        {
                            this.needAvatar() && (<div className="senderAvatar" onClick={(el) => {
                                context.onTapAvatar(message.fromUID, el)
                            }}><img alt="" src={WKApp.shared.avatarChannel(channelInfo?.channel!)} /></div>)
                        }

                        <div className={this.getBubbleBoxClassName()}>
                            <div className="wk-message-base-bubble" style={bubbleStyle} onContextMenu={(event) => {
                                context.showContextMenus(message.message, event)
                            }}>
                                <div className="wk-message-base-content">
                                    {this.props.children}

                                </div>
                                {this.renderReactions()}
                            </div>
                            {
                                !hiddeBubble ? <div className="svgAppendix">
                                    {
                                        !message.send ? (<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"></feGaussianBlur><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"></feColorMatrix></filter></defs><g fill="none" fillRule="evenodd"><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#000" filter="url(#a)"></path><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#FFF" className="corner"></path></g></svg>) :
                                            (<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"></feGaussianBlur><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"></feColorMatrix></filter></defs><g fill="none" fillRule="evenodd"><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#a)"></path><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="FFF" className="corner"></path></g></svg>)

                                    }
                                </div> : null
                            }

                        </div>
                    </div>


                    {
                        //TODO:  wk-message-error-reason 谨用这个 这个会引起ui跳动
                        message.status === MessageStatus.Fail ? <div className="wk-message-error-reason">
                            {this.getMessageErrorReason()}
                        </div> : undefined
                    }

                </div>
                {this.renderReactionDetail()}
            </div>

        )
    }
}
