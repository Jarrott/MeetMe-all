import { MediaMessageContent, MessageStatus } from "wukongimjssdk"
import React from "react"
import WKApp from "../../App"
import { MessageContentTypeConst } from "../../Service/Const"
import FileHelper from "../../Utils/filehelper"
import MessageBase from "../Base"
import { MessageBaseCellProps, MessageCell } from "../MessageCell"
import "./index.css"

export class FileContent extends MediaMessageContent {
    name!: string
    size!: number
    url!: string

    constructor(file?: File) {
        super()
        if (file) {
            this.file = file
            this.name = file.name
            this.size = file.size
            this.extension = FileHelper.getFileExt(file.name)
        }
    }

    decodeJSON(content: any) {
        this.name = content["name"] || ""
        this.size = content["size"] || 0
        this.url = content["url"] || content["path"] || content["remote_url"] || ""
        this.remoteUrl = this.url
    }

    encodeJSON() {
        return {
            name: this.name || this.file?.name || "",
            size: this.size || this.file?.size || 0,
            url: this.remoteUrl || "",
        }
    }

    get contentType() {
        return MessageContentTypeConst.file
    }

    get conversationDigest() {
        return `[文件] ${this.name || this.file?.name || ""}`
    }
}

interface FileCellState {
    menuVisible: boolean
    menuX: number
    menuY: number
}

export class FileCell extends MessageCell<MessageBaseCellProps, FileCellState> {
    $fileCard?: HTMLDivElement | null
    uploadTaskListener?: () => void
    uploadTask?: any

    constructor(props: MessageBaseCellProps) {
        super(props)
        this.state = {
            menuVisible: false,
            menuX: 0,
            menuY: 0,
        }
        this.hideMenu = this.hideMenu.bind(this)
    }

    componentDidMount() {
        document.addEventListener("click", this.hideMenu)
        document.addEventListener("scroll", this.hideMenu, true)
        this.bindUploadTask()
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.hideMenu)
        document.removeEventListener("scroll", this.hideMenu, true)
        if (this.uploadTask && this.uploadTaskListener) {
            this.uploadTask.removeListener(this.uploadTaskListener)
        }
    }

    componentDidUpdate(prevProps: MessageBaseCellProps) {
        if (prevProps.message.clientMsgNo !== this.props.message.clientMsgNo) {
            this.bindUploadTask()
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

    hideMenu() {
        if (this.state.menuVisible) {
            this.setState({ menuVisible: false })
        }
    }

    buildFileURL(content: FileContent, download = false) {
        const fileURL = content.url || content.remoteUrl
        if (!fileURL) {
            return ""
        }
        let downloadURL = WKApp.dataSource.commonDataSource.getFileURL(fileURL)
        const filename = encodeURIComponent(content.name || "file")
        if (downloadURL.indexOf("?") !== -1) {
            downloadURL += `&filename=${filename}`
        } else {
            downloadURL += `?filename=${filename}`
        }
        if (download) {
            downloadURL += `&download=1`
        }
        return downloadURL
    }

    preview(content: FileContent) {
        const url = this.buildFileURL(content)
        if (!url) {
            return
        }
        window.open(url, "_blank")
    }

    download(content: FileContent) {
        const downloadURL = this.buildFileURL(content, true)
        if (!downloadURL) {
            return
        }
        window.open(downloadURL)
    }

    forward() {
        const { message, context } = this.props
        this.hideMenu()
        context.fowardMessageUI(message.message)
    }

    menuStyle() {
        const { menuX, menuY } = this.state
        return {
            left: menuX,
            top: menuY,
        }
    }

    uploadProgress() {
        const { message } = this.props
        const task = (message.message as any).uploadTask || this.uploadTask
        if (!message.send || message.status !== MessageStatus.Wait || !task || typeof task.progress !== "function") {
            return undefined
        }
        const progress = Number(task.progress())
        if (!Number.isFinite(progress)) {
            return undefined
        }
        return Math.max(0, Math.min(0.99, progress))
    }

    render() {
        const { message, context } = this.props
        const content = message.content as FileContent
        const fileIconInfo = FileHelper.getFileIconInfo(content.name)
        const { menuVisible } = this.state
        const previewURL = this.buildFileURL(content)
        const downloadURL = this.buildFileURL(content, true)
        const uploadProgress = this.uploadProgress()
        const uploadPercent = uploadProgress === undefined ? 0 : Math.max(1, Math.floor(uploadProgress * 100))
        return <MessageBase context={context} message={message}>
            <div className="wk-message-file" ref={(ref) => { this.$fileCard = ref }} onClick={(event) => {
                event.stopPropagation()
                this.preview(content)
            }} onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const rect = this.$fileCard?.getBoundingClientRect()
                const menuWidth = 92
                const menuHeight = 120
                const x = rect ? Math.max(8, Math.min(event.clientX - rect.left, rect.width - menuWidth - 8)) : 8
                const y = rect ? Math.max(8, Math.min(event.clientY - rect.top, rect.height - menuHeight - 8)) : 8
                this.setState({
                    menuVisible: true,
                    menuX: x,
                    menuY: y,
                })
            }}>
                <div className="wk-message-file-icon" style={{ backgroundColor: fileIconInfo?.color }}>
                    <img alt="" src={fileIconInfo?.icon} />
                </div>
                <div className="wk-message-file-info">
                    <div className="wk-message-file-name">{content.name || "文件"}</div>
                    <div className="wk-message-file-size">{uploadProgress !== undefined ? `上传中 ${uploadPercent}% / ${FileHelper.getFileSizeFormat(content.size || 0)}` : FileHelper.getFileSizeFormat(content.size || 0)}</div>
                    {uploadProgress !== undefined ? <div className="wk-message-file-progress">
                        <div className="wk-message-file-progress-inner" style={{ width: `${uploadPercent}%` }}></div>
                    </div> : null}
                </div>
                {menuVisible ? <div className="wk-message-file-menu" style={this.menuStyle()} onClick={(event) => {
                    event.stopPropagation()
                }}>
                    <a href={previewURL} target="_blank" rel="noreferrer" onClick={() => this.hideMenu()}>预览</a>
                    <a href={downloadURL} target="_blank" rel="noreferrer" onClick={() => this.hideMenu()}>下载</a>
                    <button type="button" onClick={() => this.forward()}>转发</button>
                </div> : null}
            </div>
        </MessageBase>
    }
}
