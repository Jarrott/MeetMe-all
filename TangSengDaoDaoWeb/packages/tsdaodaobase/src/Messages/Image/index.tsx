import { MediaMessageContent } from "wukongimjssdk"
import React from "react"
import WKApp from "../../App"
import { MessageContentTypeConst } from "../../Service/Const"
import MessageBase from "../Base"
import MessageHead from "../Base/head"
import MessageTrail from "../Base/tail"
import { MessageCell } from "../MessageCell"
import Viewer from 'react-viewer';
import LazyMediaImage from "../../Components/LazyMediaImage";
import { copyImageURLToClipboard } from "../../Utils/mediaCopy";


export class ImageContent extends MediaMessageContent {
    width!: number
    height!: number
    url!: string
    imgData?: string
    thumb?: string
    caption?: string
    constructor(file?: File, imgData?: string, width?: number, height?: number, thumb?: string, caption?: string) {
        super()
        this.file = file
        if (file) {
            const extMatch = file.name?.toLowerCase().match(/\.([a-z0-9]+)$/)
            this.extension = extMatch ? `.${extMatch[1]}` : ".png"
        }
        this.imgData = imgData
        this.thumb = thumb
        this.caption = caption || ""
        this.width = width || 0
        this.height = height || 0
    }
    decodeJSON(content: any) {
        this.width = content["width"] || 0
        this.height = content["height"] || 0
        this.url = content["url"] || ''
        this.thumb = content["thumb"] || content["thumbnail"] || ''
        this.caption = content["caption"] || content["text"] || ''
        this.remoteUrl = this.url
    }
    encodeJSON() {
        return { "width": this.width || 0, "height": this.height || 0, "url": this.remoteUrl || this.url || "", "thumb": this.thumb || "", "caption": this.caption || "" }
    }
    get contentType() {
        return MessageContentTypeConst.image
    }
    get conversationDigest() {
        return this.caption ? `[图片] ${this.caption}` : "[图片]"
    }
}


interface ImageCellState {
    showPreview: boolean
    activeIndex: number
}

interface PreviewImage {
    src: string
    alt: string
    downloadUrl: string
}

export class ImageCell extends MessageCell<any, ImageCellState> {

    constructor(props: any) {
        super(props)
        this.state = {
            showPreview: false,
            activeIndex: 0,
        }
        this.onKeyDown = this.onKeyDown.bind(this)
    }

    componentDidMount() {
    }

    componentDidUpdate(_prevProps: any, prevState: ImageCellState) {
        if (!prevState.showPreview && this.state.showPreview) {
            document.addEventListener("keydown", this.onKeyDown)
        }
        if (prevState.showPreview && !this.state.showPreview) {
            document.removeEventListener("keydown", this.onKeyDown)
        }
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyDown)
    }

    onKeyDown(event: KeyboardEvent) {
        if (!this.state.showPreview || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") {
            return
        }
        const target = event.target as HTMLElement | null
        const tagName = target?.tagName?.toLowerCase()
        if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
            return
        }
        event.preventDefault()
        this.copyPreviewImage()
    }

    displayContent(message = this.props.message): ImageContent {
        return (message.remoteExtra?.isEdit && message.remoteExtra?.contentEdit ? message.remoteExtra.contentEdit : message.content) as ImageContent
    }

    imageScale(orgWidth: number, orgHeight: number, maxWidth = 250, maxHeight = 250) {
        if (!orgWidth || !orgHeight || orgWidth <= 0 || orgHeight <= 0) {
            return { width: maxWidth, height: maxHeight }
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

    appendImageFilename(url: string, download = false) {
        if (!url) {
            return url
        }
        let result = url
        if (result.indexOf("?") != -1) {
            result += "&filename=image.png"
        } else {
            result += "?filename=image.png"
        }
        if (download) {
            result += "&download=1"
        }
        return result
    }

    downloadOriginalImage(url?: string) {
        if (!url) {
            return
        }
        const link = document.createElement("a")
        link.href = url
        link.download = "image.png"
        link.rel = "noreferrer"
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    originalDownloadToolbar(images: PreviewImage[]) {
        return (toolbars: any[]) => {
            return toolbars.filter((item) => item.key !== "download").concat({
                key: "copyCurrent",
                render: <span className="wk-image-preview-copy">复制</span>,
                onClick: () => {
                    this.copyPreviewImage(images)
                },
            }, {
                key: "downloadOriginal",
                render: <i className="react-viewer-icon react-viewer-icon-download" />,
                onClick: () => {
                    const current = images[this.state.activeIndex] || images[0]
                    this.downloadOriginalImage(current?.downloadUrl || current?.src)
                },
            })
        }
    }

    copyPreviewImage(images = this.buildPreviewImages().images) {
        const current = images[this.state.activeIndex] || images[0]
        copyImageURLToClipboard(current?.src)
    }

    getImageSrc(content: ImageContent, thumbnail = false, download = false) {
        if (thumbnail && content.thumb) {
            return content.thumb
        }
        const imagePath = content.url || content.remoteUrl
        if (imagePath && imagePath !== "") {
            const opts = thumbnail ? this.thumbnailSize(content.width, content.height) : undefined
            let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(imagePath, opts)
            return this.appendImageFilename(downloadURL, download)
        }
        return content.imgData
    }
    getOriginalImageSrc(content: ImageContent, download = false) {
        return this.getImageSrc(content, false, download)
    }
    getThumbImageSrc(content: ImageContent) {
        return this.getImageSrc(content, true)
    }
    thumbnailSize(width: number, height: number) {
        const size = this.imageScale(width || 250, height || 250, 320, 320)
        return {
            width: Math.max(1, Math.ceil(size.width)),
            height: Math.max(1, Math.ceil(size.height)),
        }
    }
    buildPreviewImages() {
        const { message, context } = this.props
        const sourceMessages = ((context as any)?.vm?.messagesOfOrigin || (context as any)?.vm?.messages || []) as Array<any>
        let imageMessages = sourceMessages.filter((item) => {
            return item && item.contentType === MessageContentTypeConst.image && item.content
        })
        if (imageMessages.length === 0) {
            imageMessages = [message]
        }
        const previewItems = imageMessages.map((item) => {
            const imageContent = this.displayContent(item)
            const imageURL = this.getOriginalImageSrc(imageContent) || ""
            const downloadURL = this.getOriginalImageSrc(imageContent, true) || imageURL
            return {
                clientMsgNo: item.clientMsgNo,
                src: imageURL,
                alt: '',
                downloadUrl: downloadURL,
            }
        }).filter((item) => item.src !== "")
        const images = previewItems.map((item) => {
            return {
                src: item.src,
                alt: item.alt,
                downloadUrl: item.downloadUrl,
            }
        })
        let activeIndex = previewItems.findIndex((item) => item.clientMsgNo === message.clientMsgNo)
        if (activeIndex < 0) {
            activeIndex = 0
        }
        if (images.length === 0) {
            const content = this.displayContent(message)
            const imageURL = this.getOriginalImageSrc(content) || ""
            const downloadURL = this.getOriginalImageSrc(content, true) || imageURL
            return {
                images: imageURL ? [{ src: imageURL, alt: '', downloadUrl: downloadURL }] : [],
                activeIndex: 0,
            }
        }
        return { images, activeIndex }
    }

    getImageElement() {
        const { message } = this.props
        const content = this.displayContent(message)
        let scaleSize = this.imageScale(content.width, content.height);
        const imageSrc = this.getThumbImageSrc(content)
        if (!imageSrc) {
            return <div style={{ borderRadius: '5px', width: scaleSize.width, height: scaleSize.height, background: 'rgba(0,0,0,.06)', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>图片加载失败</div>
        }
        return <LazyMediaImage alt="" src={imageSrc} fallbackSrc={content.imgData} style={{ borderRadius: '5px', width: scaleSize.width, height: scaleSize.height, objectFit: 'cover' }} />
    }

    getCaptionElement() {
        const { message } = this.props
        const content = this.displayContent(message)
        const caption = (content.caption || "").trim()
        if (caption === "") {
            return null
        }
        return <div style={{ marginTop: 8, maxWidth: 250, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '20px', fontSize: 14 }}>
            {caption}
        </div>
    }

    render() {
        const { message, context } = this.props
        const { showPreview, activeIndex } = this.state
        const content = this.displayContent(message)
        let scaleSize = this.imageScale(content.width, content.height);
        const preview = this.buildPreviewImages()
        return <MessageBase context={context} message={message}>
            <div>
                <MessageHead message={message} alwaysShow={true} />
                <div style={{ width: scaleSize.width, height: scaleSize.height, cursor: "pointer" }} onClick={() => {
                    if (preview.images.length === 0) {
                        return
                    }
                    this.setState({
                        showPreview: !this.state.showPreview,
                        activeIndex: preview.activeIndex,
                    })
                }}>
                    {this.getImageElement()}
                </div>
                {this.getCaptionElement()}
                <div style={{ marginTop: 4, textAlign: message.send ? "right" : "left" }}>
                    <MessageTrail message={message} />
                </div>
            </div>
            <Viewer
                visible={showPreview}
                noImgDetails={true}
                downloadable={false}
                rotatable={false}
                changeable={preview.images.length > 1}
                showTotal={preview.images.length > 1}
                activeIndex={activeIndex}
                customToolbar={this.originalDownloadToolbar(preview.images)}
                onChange={(_, index) => {
                    this.setState({ activeIndex: index })
                }}
                onMaskClick={() => { this.setState({ showPreview: false }); }}
                onClose={() => { this.setState({ showPreview: false }); }}
                images={preview.images}
            />
        </MessageBase>
    }
}
