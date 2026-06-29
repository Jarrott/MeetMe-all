import { MessageStatus } from "wukongimjssdk";
import moment from "moment";
import React from "react";
import { Component, CSSProperties } from "react";
import { MessageWrap } from "../../Service/Model";

interface MessageTrailProps {
    message: MessageWrap
    timeStyle?: CSSProperties
    statusStyle?:CSSProperties
    onEditClick?: () => void
}


export default class MessageTrail extends Component<MessageTrailProps> {
    uploadTask?: any
    uploadTaskListener?: () => void

    componentDidMount() {
        this.bindUploadTask()
    }

    componentDidUpdate(prevProps: MessageTrailProps) {
        if (prevProps.message.clientMsgNo !== this.props.message.clientMsgNo) {
            this.bindUploadTask()
        }
    }

    componentWillUnmount() {
        if (this.uploadTask && this.uploadTaskListener) {
            this.uploadTask.removeListener(this.uploadTaskListener)
        }
    }

    bindUploadTask() {
        const task = (this.props.message.message as any).uploadTask
        if (!task || task === this.uploadTask) {
            return
        }
        if (this.uploadTask && this.uploadTaskListener) {
            this.uploadTask.removeListener(this.uploadTaskListener)
        }
        this.uploadTask = task
        this.uploadTaskListener = () => {
            this.setState({})
        }
        task.addListener(this.uploadTaskListener)
    }

    shouldShowDeliveryStatus() {
        const { message } = this.props
        if (!message.send || message.status === MessageStatus.Fail) {
            return false
        }
        return true
    }
    isReaded() {
        const { message } = this.props
        return message.readedCount >= 1 || message.remoteExtra?.readed
    }

    getMessageStatusIconClass() {
        const { message } = this.props
        if(!this.shouldShowDeliveryStatus()) {
            return null
        }
        if(message.status === MessageStatus.Wait) {
            return "icon-message-pending"
        }
        if(this.isReaded()) {
            return "icon-message-read"
        }
        return null
    }

    getMessageStatusText() {
        const { message } = this.props
        if (!this.shouldShowDeliveryStatus()) {
            return ""
        }
        if (message.status === MessageStatus.Wait) {
            const task = (message.message as any).uploadTask || this.uploadTask
            const progress = typeof task?.progress === "function" ? Number(task.progress()) : undefined
            if (progress !== undefined && Number.isFinite(progress) && progress > 0 && progress < 1) {
                return `上传 ${Math.max(1, Math.floor(progress * 100))}%`
            }
            return "发送中"
        }
        if (this.isReaded()) {
            return ""
        }
        return "未读"
    }

    renderMessageStatus(statusStyle?: CSSProperties) {
        const iconClass = this.getMessageStatusIconClass()
        const text = this.getMessageStatusText()
        if (!iconClass && !text) {
            return null
        }
        return <span className="messageStatus" style={statusStyle}>
            {text ? <span className="messageStatusText">{text}</span> : null}
            {iconClass ? <i className={iconClass}></i> : null}
        </span>
    }

    render() {
        const { message,timeStyle,statusStyle,onEditClick } = this.props
        return <span className="messageMeta">
            {message.remoteExtra?.isEdit?<span className="messageTime wk-message-edited-label" onClick={(event) => {
                event.stopPropagation()
                if (onEditClick) {
                    onEditClick()
                }
            }}>已编辑</span>:null}
            <span className="messageTime" style={timeStyle}> {moment(message.timestamp * 1000).format('HH:mm')}</span>
            {message.send ? this.renderMessageStatus(statusStyle) : null}
        </span>
    }
}
