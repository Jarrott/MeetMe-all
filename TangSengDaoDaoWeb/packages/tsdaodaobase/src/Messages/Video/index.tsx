import { MediaMessageContent } from "wukongimjssdk";
import React from "react";
import WKApp from "../../App";
import { MessageContentTypeConst } from "../../Service/Const";
import MessageBase from "../Base";
import { MessageCell } from "../MessageCell";
import "./index.css"

export class VideoContent extends MediaMessageContent {
    url!: string  // 小视频下载地址
    cover!: string // 小视频封面图片下载地址
    size: number = 0 // 小视频大小 单位byte
    width!: number // 小视频宽度
    height!: number // 小视频高度
    second!: number // 小视频秒长
    mimeType!: string
    caption?: string

    constructor(file?: File, cover?: string, width?: number, height?: number, second?: number, caption?: string) {
        super()
        if (file) {
            this.file = file
            this.size = file.size
            this.mimeType = file.type || "video/mp4"
            const extMatch = file.name?.toLowerCase().match(/\.([a-z0-9]+)$/)
            this.extension = extMatch ? `.${extMatch[1]}` : ".mp4"
        }
        this.cover = cover || ""
        this.width = width || 0
        this.height = height || 0
        this.second = second || 0
        this.caption = caption || ""
    }

    decodeJSON(content: any) {
        this.url = content["url"] || ""
        this.remoteUrl = this.url
        this.cover = content["cover"] || ""
        this.size = content["size"] || 0
        this.width = content["width"] || 0
        this.height = content["height"] || 0
        this.second = content["second"] || 0
        this.mimeType = content["mime_type"] || content["mimeType"] || "video/mp4"
        this.caption = content["caption"] || content["text"] || ""
    }

    encodeJSON() {
        const cover = this.cover && this.cover.indexOf("data:") !== 0 && this.cover.indexOf("blob:") !== 0 ? this.cover : ""
        return { "url": this.remoteUrl || this.url || "", "cover": cover, "size": this.size || this.file?.size || 0, "width": this.width || 0, "height": this.height || 0, "second": this.second || 0, "mime_type": this.mimeType || this.file?.type || "video/mp4", "caption": this.caption || "" }
    }

    get contentType() {
        return MessageContentTypeConst.smallVideo
    }

    get conversationDigest() {
        return this.caption ? `[小视频] ${this.caption}` : "[小视频]"
    }

}

interface VideoCellState {
    playProgress: number // 播放进度
    localURL?: string
}

export class VideoCell extends MessageCell<any, VideoCellState> {

    constructor(props: any) {
        super(props)
        this.state = {
            playProgress: 0,
        }

    }
    componentDidMount() {
        this.ensureLocalURL()
    }

    componentWillUnmount() {
        if (this.state.localURL) {
            URL.revokeObjectURL(this.state.localURL)
        }
    }

    componentDidUpdate(prevProps: any) {
        const prevContent = this.displayContent(prevProps.message)
        const content = this.displayContent()
        if (prevContent?.file !== content?.file) {
            if (this.state.localURL) {
                URL.revokeObjectURL(this.state.localURL)
            }
            this.setState({ localURL: undefined }, () => this.ensureLocalURL())
        }
    }

    ensureLocalURL() {
        const content = this.displayContent()
        if (!content.file || this.state.localURL) {
            return
        }
        try {
            this.setState({ localURL: URL.createObjectURL(content.file) })
        } catch (error) {
            console.warn("创建本地视频预览失败", error)
        }
    }

    videoURL(content: VideoContent) {
        if (content.url || content.remoteUrl) {
            let downloadURL = WKApp.dataSource.commonDataSource.getFileURL(content.url || content.remoteUrl)
            if (downloadURL.indexOf("?") !== -1) {
                downloadURL += "&filename=video.mp4"
            } else {
                downloadURL += "?filename=video.mp4"
            }
            return downloadURL
        }
        return this.state.localURL || ""
    }

    download(content: VideoContent) {
        const url = this.videoURL(content)
        if (!url) {
            return
        }
        window.open(url)
    }

    secondFormat(second: number): string {

        const minute = parseInt(`${( second / 60)}`)
        const realSecond = parseInt(`${second % 60}`)

        let minuteFormat = ""
        if (minute > 9) {
            minuteFormat = `${minute}`
        } else {
            minuteFormat = `0${minute}`
        }

        let secondFormat = ""
        if (realSecond > 9) {
            secondFormat = `${realSecond}`
        } else {
            secondFormat = `0${realSecond}`
        }

        return `${minuteFormat}:${secondFormat}`
    }

    videoScale(orgWidth: number, orgHeight: number, maxWidth = 380, maxHeight = 380) {
        if (!orgWidth || !orgHeight || orgWidth <= 0 || orgHeight <= 0) {
            return { width: Math.min(maxWidth, 320), height: Math.min(maxHeight, 220) }
        }
        let actSize = { width: orgWidth, height: orgHeight };
        if (orgWidth > orgHeight) {//横图
            if (orgWidth > maxWidth) { // 横图超过最大宽度
                let rate = maxWidth / orgWidth; // 缩放比例
                actSize.width = maxWidth;
                actSize.height = orgHeight * rate;
            }
        } else if (orgWidth < orgHeight) { //竖图
            if (orgHeight > maxHeight) {
                let rate = maxHeight / orgHeight; // 缩放比例
                actSize.width = orgWidth * rate;
                actSize.height = maxHeight;
            }
        } else if (orgWidth === orgHeight) {
            if (orgWidth > maxWidth) {
                let rate = maxWidth / orgWidth; // 缩放比例
                actSize.width = maxWidth;
                actSize.height = orgHeight * rate;
            }
        }
        return actSize;
    }

    displayContent(message = this.props.message): VideoContent {
        return (message.remoteExtra?.isEdit && message.remoteExtra?.contentEdit ? message.remoteExtra.contentEdit : message.content) as VideoContent
    }

    render() {
        const { message, context } = this.props
        const { playProgress } = this.state
        const content = this.displayContent()
        const actSize = this.videoScale(content.width, content.height)
        const videoURL = this.videoURL(content)
        const posterURL = content.cover ? WKApp.dataSource.commonDataSource.getImageURL(content.cover, {
            width: Math.ceil(actSize.width),
            height: Math.ceil(actSize.height),
        }) : undefined
        const videoType = content.mimeType || content.file?.type || "video/mp4"
        return <MessageBase hiddeBubble={true} message={message} context={context}>

            <div className="wk-message-video" style={{ width: actSize.width, height: '100%' }}>
                <div className="wk-message-video-content">
                    <span className="wk-message-video-content-time">{this.secondFormat(content.second - playProgress)}</span>
                    <button className="wk-message-video-download" title="下载视频" onClick={(event) => {
                        event.stopPropagation()
                        this.download(content)
                    }}>下载</button>
                    <div className="wk-message-video-content-video">
                        <video poster={posterURL} width={actSize.width} height={actSize.height} controls preload="none" playsInline onTimeUpdate={(evet) => {
                            const video = evet.target as HTMLVideoElement
                            this.setState({
                                playProgress: video.currentTime,
                            })
                        }} onEnded={() => {
                            this.setState({
                                playProgress: 0,
                            })
                        }}>
                            <source src={videoURL} type={videoType} />
                        </video>
                    </div>
                    {
                        content.caption ? <div className="wk-message-video-caption">{content.caption}</div> : null
                    }
                </div>
            </div>
        </MessageBase>
    }
}
