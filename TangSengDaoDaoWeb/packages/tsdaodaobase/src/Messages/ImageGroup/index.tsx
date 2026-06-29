import { MediaMessageContent } from "wukongimjssdk"
import React from "react"
import Viewer from "react-viewer"
import WKApp from "../../App"
import { MessageContentTypeConst } from "../../Service/Const"
import MessageBase from "../Base"
import MessageHead from "../Base/head"
import MessageTrail from "../Base/tail"
import { MessageCell } from "../MessageCell"
import LazyMediaImage from "../../Components/LazyMediaImage"
import { copyImageURLToClipboard } from "../../Utils/mediaCopy"
import "./index.css"

export interface ImageGroupItem {
    file?: File
    url?: string
    imgData?: string
    thumb?: string
    width: number
    height: number
    extension?: string
}

export class ImageGroupContent extends MediaMessageContent {
    images: ImageGroupItem[] = []
    caption?: string

    constructor(images?: ImageGroupItem[], caption?: string) {
        super()
        this.images = images || []
        this.caption = caption || ""
        this.prepareUploadMarker()
    }

    prepareUploadMarker() {
        const firstLocalImage = (this.images || []).find((item) => item.file)
        if (!firstLocalImage?.file) {
            return
        }
        this.file = firstLocalImage.file
        this.extension = firstLocalImage.extension || ""
    }

    decodeJSON(content: any) {
        this.images = Array.isArray(content["images"]) ? content["images"].map((item: any) => {
            return {
                url: item["url"] || "",
                thumb: item["thumb"] || item["thumbnail"] || "",
                width: item["width"] || 0,
                height: item["height"] || 0,
            }
        }) : []
        this.caption = content["caption"] || content["text"] || ""
    }

    encodeJSON() {
        return {
            images: (this.images || []).map((item) => {
                return {
                    url: item.url || "",
                    width: item.width || 0,
                    height: item.height || 0,
                }
            }),
            caption: this.caption || "",
        }
    }

    get contentType() {
        return MessageContentTypeConst.imageGroup
    }

    get conversationDigest() {
        const count = this.images?.length || 0
        const caption = (this.caption || "").trim()
        return caption ? `[${count}张图片] ${caption}` : `[${count}张图片]`
    }
}

interface ImageGroupCellState {
    showPreview: boolean
    activeIndex: number
    menuVisible: boolean
    menuX: number
    menuY: number
    menuIndex: number
}

interface PreviewImage {
    src: string
    alt: string
    downloadUrl: string
}

export class ImageGroupCell extends MessageCell<any, ImageGroupCellState> {
    constructor(props: any) {
        super(props)
        this.state = {
            showPreview: false,
            activeIndex: 0,
            menuVisible: false,
            menuX: 0,
            menuY: 0,
            menuIndex: 0,
        }
        this.hideMenu = this.hideMenu.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
    }

    componentDidMount() {
        document.addEventListener("click", this.hideMenu)
        document.addEventListener("scroll", this.hideMenu, true)
    }

    componentDidUpdate(_prevProps: any, prevState: ImageGroupCellState) {
        if (!prevState.showPreview && this.state.showPreview) {
            document.addEventListener("keydown", this.onKeyDown)
        }
        if (prevState.showPreview && !this.state.showPreview) {
            document.removeEventListener("keydown", this.onKeyDown)
        }
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.hideMenu)
        document.removeEventListener("scroll", this.hideMenu, true)
        document.removeEventListener("keydown", this.onKeyDown)
    }

    hideMenu() {
        if (this.state.menuVisible) {
            this.setState({ menuVisible: false })
        }
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

    displayContent(): ImageGroupContent {
        const message = this.props.message
        return (message.remoteExtra?.isEdit && message.remoteExtra?.contentEdit ? message.remoteExtra.contentEdit : message.content) as ImageGroupContent
    }

    appendImageFilename(url: string, download = false) {
        if (!url) {
            return url
        }
        let result = url
        if (result.indexOf("?") !== -1) {
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

    imageURL(item: ImageGroupItem, thumbnail = false, download = false) {
        if (thumbnail && item.thumb) {
            return item.thumb
        }
        if (item.url) {
            const opts = thumbnail ? { width: 320, height: 320 } : undefined
            let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(item.url, opts)
            return this.appendImageFilename(downloadURL, download)
        }
        return item.imgData || ""
    }
    originalImageURL(item: ImageGroupItem, download = false) {
        return this.imageURL(item, false, download)
    }
    thumbImageURL(item: ImageGroupItem) {
        return this.imageURL(item, true)
    }

    buildPreviewImages() {
        const content = this.displayContent()
        return (content.images || []).map((item) => {
            const src = this.originalImageURL(item) || this.thumbImageURL(item)
            const downloadUrl = this.originalImageURL(item, true) || src
            return {
                src,
                alt: "",
                downloadUrl,
            }
        }).filter((item) => item.src !== "")
    }

    copyPreviewImage(images = this.buildPreviewImages()) {
        const current = images[this.state.activeIndex] || images[0]
        copyImageURLToClipboard(current?.src)
    }

    copyImageAt(index: number) {
        const image = this.buildPreviewImages()[index]
        copyImageURLToClipboard(image?.src)
    }

    getGridStyle(count: number): React.CSSProperties {
        const visibleCount = Math.min(count, 4)
        const width = visibleCount === 1 ? 250 : 252
        return {
            width,
            display: "grid",
            gap: 4,
            gridTemplateColumns: visibleCount === 1 ? "1fr" : "repeat(2, 1fr)",
        }
    }

    renderThumb(item: ImageGroupItem, index: number, count: number) {
        const src = this.thumbImageURL(item)
        const visibleCount = Math.min(count, 4)
        const size = visibleCount === 1 ? 250 : 124
        const height = visibleCount === 1 ? 180 : 124
        const remainingCount = count - 4
        const showRemaining = index === 3 && remainingCount > 0
        return <div key={index} style={{ width: size, height, borderRadius: 6, overflow: "hidden", background: "rgba(0,0,0,.06)", cursor: "pointer", position: "relative" }} onClick={() => {
            const previewImages = this.buildPreviewImages()
            if (previewImages.length === 0) {
                return
            }
            this.setState({
                showPreview: true,
                activeIndex: index,
            })
        }} onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const grid = (event.currentTarget.parentElement || event.currentTarget).getBoundingClientRect()
            const menuWidth = 104
            const menuHeight = 116
            this.setState({
                menuVisible: true,
                menuIndex: index,
                menuX: Math.max(8, Math.min(event.clientX - grid.left, grid.width - menuWidth - 8)),
                menuY: Math.max(8, Math.min(event.clientY - grid.top, grid.height - menuHeight - 8)),
            })
        }}>
            {
                src ? <LazyMediaImage alt="" src={src} fallbackSrc={item.imgData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}>图片加载失败</div>
            }
            {
                showRemaining ? <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.48)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>
                    +{remainingCount}张
                </div> : null
            }
        </div>
    }

    renderThumbMenu() {
        const { menuVisible, menuX, menuY, menuIndex } = this.state
        if (!menuVisible) {
            return null
        }
        const previewImages = this.buildPreviewImages()
        const image = previewImages[menuIndex]
        return <div className="wk-image-group-menu" style={{ left: menuX, top: menuY }} onClick={(event) => {
            event.stopPropagation()
        }}>
            <button type="button" onClick={() => {
                this.copyImageAt(menuIndex)
                this.hideMenu()
            }}>复制图片</button>
            <button type="button" onClick={() => {
                this.hideMenu()
                if (previewImages.length > 0) {
                    this.setState({ showPreview: true, activeIndex: menuIndex })
                }
            }}>预览</button>
            <button type="button" onClick={() => {
                this.hideMenu()
                this.downloadOriginalImage(image?.downloadUrl || image?.src)
            }}>下载原图</button>
        </div>
    }

    renderCaption() {
        const content = this.displayContent()
        const caption = (content.caption || "").trim()
        if (!caption) {
            return null
        }
        return <div style={{ marginTop: 8, maxWidth: 258, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "20px", fontSize: 14 }}>{caption}</div>
    }

    render() {
        const { message, context } = this.props
        const { showPreview, activeIndex } = this.state
        const content = this.displayContent()
        const images = content.images || []
        const visibleImages = images.slice(0, 4)
        const previewImages = this.buildPreviewImages()
        return <MessageBase context={context} message={message}>
            <div>
                <MessageHead message={message} alwaysShow={true} />
                <div className="wk-image-group-grid" style={this.getGridStyle(images.length)}>
                    {visibleImages.map((item, index) => this.renderThumb(item, index, images.length))}
                    {this.renderThumbMenu()}
                </div>
                {this.renderCaption()}
                <div style={{ marginTop: 4, textAlign: message.send ? "right" : "left" }}>
                    <MessageTrail message={message} />
                </div>
            </div>
            <Viewer
                visible={showPreview}
                noImgDetails={true}
                downloadable={false}
                rotatable={false}
                changeable={previewImages.length > 1}
                showTotal={previewImages.length > 1}
                activeIndex={activeIndex}
                customToolbar={this.originalDownloadToolbar(previewImages)}
                onChange={(_, index) => {
                    this.setState({ activeIndex: index })
                }}
                onMaskClick={() => { this.setState({ showPreview: false }) }}
                onClose={() => { this.setState({ showPreview: false }) }}
                images={previewImages}
            />
        </MessageBase>
    }
}
