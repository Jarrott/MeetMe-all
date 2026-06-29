import classNames from "classnames";
import { Modal } from "@douyinfe/semi-ui";
import React from "react";
import WKApp from "../../App";
import { Part, PartType } from "../../Service/Model";
import MessageBase from "../Base";
import MessageHead from "../Base/head";
import MessageTrail from "../Base/tail";
import { MessageCell } from "../MessageCell";
import { getMessagePlainText, getPreferredTargetLang, getUserAutoTranslateOn, shouldSkipAutoTranslate } from "../../Service/Translate";
import "./index.css"

interface TextCellState {
    translationLoading?: boolean
    showEditHistory?: boolean
}

// 文本消息
export class TextCell extends MessageCell<any, TextCellState> {
    constructor(props: any) {
        super(props)
    }

    componentDidMount() {
        this.tryAutoTranslate()
    }

    componentDidUpdate(prevProps: any) {
        if (prevProps.message.clientMsgNo !== this.props.message.clientMsgNo) {
            this.tryAutoTranslate()
        }
    }

    getCommonText(k: number, part: Part) {
        const texts = part.text.split("\n")
        const { message } = this.props
        return <span key={`${message.clientMsgNo}-text-${k}`} className="wk-message-text-commontext">
            {
                texts.map((text, i) => {
                    return <span key={`${message.clientMsgNo}-common-${i}`} className="wk-message-text-richtext">{text}{i !== texts.length - 1 ? <br /> : undefined}</span>
                })
            }
        </span>
    }

    getMentionText(k: number, part: Part) {
        const { message,context } = this.props
        return <span onClick={()=>{
            if(part.data?.uid) {
                context.showUser(part.data?.uid)
            }
        }} key={`${message.clientMsgNo}-mention-${k}`} className={classNames("wk-message-text-richmention", message.send ? "wk-message-text-send" : "wk-message-text-recv")}>{part.text}</span>
    }

    getEmojiText(k: number, part: Part) {
        const { message } = this.props
        const emojiURL = WKApp.emojiService.getImage(part.text)
        return <span key={`${message.clientMsgNo}-emoji-${k}`} className="wk-message-text-richemoji">
            {emojiURL !== "" ? <img alt="" src={emojiURL} /> : part.text}
        </span>
    }

    isLargeEmojiOnly() {
        const { message } = this.props
        const parts = message.parts || []
        let emojiCount = 0
        for (const part of parts) {
            if (part.type === PartType.emoji) {
                emojiCount += 1
                continue
            }
            if (part.type === PartType.text && part.text.trim() === "") {
                continue
            }
            return false
        }
        return emojiCount > 0 && emojiCount <= 3
    }

    getLinkText(k: number, part: Part) {
        const { message } = this.props
        let link = part.text
        if(link.indexOf("http") !== 0) {
            link = "http://" + link
        }
        return <a  key={`${message.clientMsgNo}-link-${k}`} href={link} target="__blank">{part.text}</a>
    }

    getRenderMessageText() {
        const { message } = this.props
        const parts = message.parts
        const elements = new Array<JSX.Element>()
        if (parts && parts.length > 0) {
            let i = 0
            for (const part of parts) {
                part.text.split("\n")
                if (part.type === PartType.text) {
                   elements.push(this.getCommonText(i, part))
                } else if (part.type === PartType.mention) {
                    elements.push(this.getMentionText(i, part))
                } else if (part.type === PartType.emoji) {
                   elements.push(this.getEmojiText(i, part))
                }else if(part.type === PartType.link) {
                    elements.push(this.getLinkText(i,part))
                }
                i++
            }
        }
        return elements
    }

    tryAutoTranslate() {
        const { message } = this.props
        const rawMessage = message.message as any
        if (!WKApp.remoteConfig.autoTranslateOn || !getUserAutoTranslateOn(WKApp.loginInfo.uid) || message.send || rawMessage.translationText || rawMessage.translationLoading) {
            return
        }
        const text = getMessagePlainText(message.message)
        const targetLang = getPreferredTargetLang()
        if (shouldSkipAutoTranslate(text, targetLang)) {
            return
        }
        rawMessage.translationLoading = true
        this.setState({ translationLoading: true })
        WKApp.dataSource.commonDataSource.translateMessage(message.message, targetLang).then((resp) => {
            rawMessage.translationText = resp.translated_text
            rawMessage.translationTargetLang = resp.target_lang
            rawMessage.translationLoading = false
            this.setState({ translationLoading: false })
        }).catch(() => {
            rawMessage.translationLoading = false
            this.setState({ translationLoading: false })
        })
    }

    renderTranslation() {
        const { message } = this.props
        const rawMessage = message.message as any
        if (rawMessage.translationLoading) {
            return <div className={classNames("wk-message-text-translation", message.send ? "wk-message-text-translation-send" : undefined)}>翻译中...</div>
        }
        if (!rawMessage.translationText) {
            return null
        }
        return <div className={classNames("wk-message-text-translation", message.send ? "wk-message-text-translation-send" : undefined)}>
            {rawMessage.translationText}
        </div>
    }
    renderEditHistory() {
        const { message } = this.props
        const originalContent = message.content as any
        const editedContent = message.remoteExtra?.contentEdit as any
        const originalText = originalContent?.text || originalContent?.content || originalContent?.conversationDigest || ""
        const editedText = editedContent?.text || editedContent?.content || editedContent?.conversationDigest || ""
        return <Modal title="编辑记录" visible={!!this.state?.showEditHistory} footer={null} onCancel={() => {
            this.setState({ showEditHistory: false })
        }}>
            <div className="wk-message-text-edit-history">
                <div className="wk-message-text-edit-history-title">编辑前</div>
                <div className="wk-message-text-edit-history-content">{originalText || "无内容"}</div>
                <div className="wk-message-text-edit-history-title">编辑后</div>
                <div className="wk-message-text-edit-history-content">{editedText || "无内容"}</div>
            </div>
        </Modal>
    }

    render() {
        const { message, context } = this.props
        return <MessageBase message={message} context={context} onBubble={() => {
        }}>
            <MessageHead message={message} />
            {
                message?.content.reply ? <div className={classNames("wk-message-text-reply",message.send?undefined:"wk-message-text-reply-recv")} onClick={()=>{
                    context.locateMessage( message?.content.reply.messageSeq)
                }}>
                    <div className="wk-message-text-reply-author">
                        <div className="wk-message-text-reply-authoravatar">
                            <img alt="" src={WKApp.shared.avatarUser(message.content.reply.fromUID)} style={{ width: "12px", height: "12px",borderRadius:"50%" }} />
                        </div>
                        <div className="wk-message-text-reply-authorname">
                            {message.content.reply.fromName} 
                        </div>
                    </div>
                    <div className="wk-message-text-reply-content">
                        {message.content.reply.content?.conversationDigest}
                    </div>
                </div> : undefined
            }

            <p className={classNames("wk-message-text-content", this.isLargeEmojiOnly() ? "wk-message-text-content-largeemoji" : undefined)}>
                {this.getRenderMessageText()}
                <MessageTrail message={message} onEditClick={() => {
                    this.setState({ showEditHistory: true })
                }} />
            </p>
            {this.renderTranslation()}
            {this.renderEditHistory()}
        </MessageBase>
    }
}
