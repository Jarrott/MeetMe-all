import { MessageContent, MessageContentType } from "wukongimjssdk";
import React from "react";
import MessageBase from "../Base";
import { MessageCell } from "../MessageCell";

const tip = "[收到一条网页版暂不支持的消息类型，请在手机上查看]"

export class UnsupportContent extends MessageContent {
    private text: string

    constructor(text: string = tip) {
        super()
        this.text = text
    }

    get contentType() {
        return MessageContentType.unknown
    }

    get displayText() {
        return this.text
    }

    get conversationDigest() {
        return this.text
    }

}


export class UnsupportCell  extends MessageCell {
     render()  {
         const {message,context} = this.props
        const content = message.content as UnsupportContent
        return <MessageBase context={context} message={message}>{content.displayText || tip}</MessageBase>
    }
}   
