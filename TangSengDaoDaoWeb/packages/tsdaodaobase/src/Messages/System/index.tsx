import { SystemContent } from "wukongimjssdk"
import React from "react"
import { MessageCell } from "../MessageCell"
import  './index.css'

export class SystemCell  extends MessageCell {

     render()  {
         const {message} = this.props
        const content = message.content as SystemContent
        let text = "[系统消息]"
        try {
            text = content.displayText || text
        } catch (error) {
            console.warn("系统消息渲染失败", message, error)
        }
        return <div className="wk-message-system">{text}</div>
    }
}
