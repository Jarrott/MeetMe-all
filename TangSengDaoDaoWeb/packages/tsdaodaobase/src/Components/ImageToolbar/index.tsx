import { ConversationContext, FileContent, FileHelper, ImageContent, WKApp } from "@tsdaodao/base";
import { Toast } from "@douyinfe/semi-ui";
import React from "react";
import { Component, ReactNode } from "react";
import { VideoContent } from "../../Messages/Video";
import { ImageGroupContent } from "../../Messages/ImageGroup";
import type { MentionModel } from "../MessageInput";

import "./index.css"

const MAX_IMAGE_COUNT = 100
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif"]
const IMAGE_MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
}
const IMAGE_EXT_TO_MIME: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    avif: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
}
const VIDEO_EXTS = ["mp4", "mov", "m4v", "webm", "ogg", "ogv"]
const VIDEO_MIME_TO_EXT: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/webm": "webm",
    "video/ogg": "ogv",
}


interface ImageToolbarProps {
    conversationContext: ConversationContext
    icon: string
    accept?: string
    mode?: "auto" | "image" | "file"
    label?: string
}

interface ImageToolbarState {
    showDialog: boolean
    file?: any
    fileType?: string
    previewUrl?: any,
    fileIconInfo?: any,
    canSend?: boolean
    width?: number
    height?: number
    duration?: number
    videoCover?: string
    imageItems?: ImagePreviewItem[]
}

interface ImagePreviewItem {
    file: File
    previewUrl: string
    width: number
    height: number
    extension: string
    thumbUrl?: string
}

interface VideoPreviewInfo {
    file: File
    previewUrl: string
    coverUrl: string
    width: number
    height: number
    duration: number
    extension: string
}

export default class ImageToolbar extends Component<ImageToolbarProps, ImageToolbarState>{
    pasteListen!:(event:any)=>void
    imageCaption: string = ""
    lastPasteSignature: string = ""
    lastPasteAt: number = 0
    sendInterceptorKey: string = `image-toolbar-${Date.now()}-${Math.random().toString(16).slice(2)}`
    $inlineAddInput: any
    constructor(props:any) {
        super(props)
        this.state = {
            showDialog: false,
        }
    }

    componentDidMount() {
        let self = this;

        const { conversationContext } = this.props

        this.pasteListen = function (event:any) { // 监听粘贴里的文件
            const { mode = "auto" } = self.props
            if (mode === "file") {
                return
            }
            const imageFiles = self.clipboardImageFiles(event)
            if (imageFiles.length > 0) {
                const signature = self.filesSignature(imageFiles)
                const now = Date.now()
                if (signature !== "" && signature === self.lastPasteSignature && now - self.lastPasteAt < 800) {
                    event.preventDefault();
                    return
                }
                self.lastPasteSignature = signature
                self.lastPasteAt = now
                self.showFiles(imageFiles);
                event.preventDefault();
            }
        }
        document.addEventListener('paste',this.pasteListen )

        conversationContext.setDragFileCallback((files)=>{
            self.showFiles(files);
        })
        this.registerSendInterceptor()
    }

    componentWillUnmount() {
        document.removeEventListener("paste",this.pasteListen)
        try {
            this.props.conversationContext.messageInputContext()?.unregisterSendInterceptor(this.sendInterceptorKey)
        } catch (error) {
            // input context may already be unmounted
        }
    }

    $fileInput: any
    onFileClick = (event: any) => {
        event.target.value = '' // 防止选中一个文件取消后不能再选中同一个文件
    }
    onFileChange() {
        this.showFiles(this.$fileInput.files);
    }
    chooseFile = () => {
        this.$fileInput.click();
    }
    showFiles(files: FileList | File[]) {
        const fileList = this.normalizeIncomingFiles(files)
        if (fileList.length === 0) {
            return
        }
        const { mode = "auto" } = this.props
        const imageFiles = fileList.filter((file) => this.isImageFile(file))
        if ((mode === "auto" || mode === "image" || mode === "file") && imageFiles.length > 0) {
            this.showImages(imageFiles)
            return
        }
        const videoFile = fileList.find((file) => this.isVideoFile(file))
        if (videoFile) {
            this.showVideo(videoFile)
            return
        }
        if (mode === "image") {
            Toast.warning("请选择图片文件")
            return
        }
        this.showFile(fileList[0])
    }
    showFile(file: any) {
        const self = this
        const { mode = "auto" } = this.props
        if ((mode === "auto" || mode === "image" || mode === "file") && this.isImageFile(file)) {
            this.showImages([file])
            return
        }
        if (this.isVideoFile(file)) {
            this.showVideo(file)
            return
        }
        if (mode === "image") {
            Toast.warning("请选择图片文件")
            return
        }
        this.setState({
            file: file,
            fileType: "file",
            fileIconInfo: FileHelper.getFileIconInfo(file.name),
            showDialog: true,
            canSend: true,
            imageItems: undefined,
            videoCover: undefined,
        })

    }
    showVideo(file: File) {
        this.setState({
            file,
            fileType: "video",
            previewUrl: "",
            videoCover: "",
            showDialog: true,
            canSend: false,
            imageItems: undefined,
        })
        this.readVideo(file).then((video) => {
            this.setState({
                file: video.file,
                previewUrl: video.previewUrl,
                videoCover: video.coverUrl,
                width: video.width,
                height: video.height,
                duration: video.duration,
                canSend: true,
            })
        }).catch(() => {
            Toast.error("视频读取失败，请换一个文件")
            this.setState({
                showDialog: false,
                canSend: false,
            })
        })
    }
    showImages(files: File[]) {
        const currentItems = this.state.imageItems || []
        const remainCount = MAX_IMAGE_COUNT - currentItems.length
        if (remainCount <= 0) {
            Toast.warning(`一次最多发送 ${MAX_IMAGE_COUNT} 张图片`)
            return
        }
        let nextFiles = files.map((file, index) => this.normalizeImageFile(file, currentItems.length + index)).slice(0, remainCount)
        if (files.length > remainCount) {
            Toast.warning(`一次最多发送 ${MAX_IMAGE_COUNT} 张图片，已自动保留前 ${MAX_IMAGE_COUNT} 张`)
        }
        this.setState({
            fileType: "image",
            showDialog: false,
            canSend: false,
            imageItems: currentItems,
        })
        Promise.all(nextFiles.map((file) => this.readImage(file).catch(() => undefined))).then((items) => {
            const validItems = items.filter(Boolean) as ImagePreviewItem[]
            if (validItems.length < nextFiles.length) {
                Toast.warning("部分图片读取失败，已自动跳过")
            }
            const mergedItems = [...(this.state.imageItems || []), ...validItems]
            this.setState({
                file: mergedItems[0]?.file,
                previewUrl: mergedItems[0]?.previewUrl,
                width: mergedItems[0]?.width,
                height: mergedItems[0]?.height,
                imageItems: mergedItems,
                canSend: mergedItems.length > 0,
            })
        })
    }
    removeImage(index: number) {
        const imageItems = [...(this.state.imageItems || [])]
        imageItems.splice(index, 1)
        this.setState({
            imageItems,
            fileType: imageItems.length > 0 ? this.state.fileType : undefined,
            file: imageItems[0]?.file,
            previewUrl: imageItems[0]?.previewUrl,
            width: imageItems[0]?.width,
            height: imageItems[0]?.height,
            canSend: imageItems.length > 0,
        })
    }
    readImage(file: File): Promise<ImagePreviewItem> {
        return new Promise((resolve, reject) => {
            if (!file || file.size <= 0) {
                reject(new Error("empty image file"))
                return
            }
            let previewUrl = ""
            try {
                previewUrl = URL.createObjectURL(file)
            } catch (error) {
                reject(error)
                return
            }
            const image = new Image()
            image.onload = async () => {
                resolve({
                    file,
                    previewUrl,
                    width: image.naturalWidth || image.width,
                    height: image.naturalHeight || image.height,
                    extension: this.imageExtension(file),
                    thumbUrl: await this.makeImageThumb(image).catch(() => previewUrl),
                })
            }
            image.onerror = () => {
                reject(new Error("image preview decode failed"))
            }
            image.src = previewUrl
        })
    }

    readVideo(file: File): Promise<VideoPreviewInfo> {
        return new Promise((resolve, reject) => {
            if (!file || file.size <= 0) {
                reject(new Error("empty video file"))
                return
            }
            let previewUrl = ""
            try {
                previewUrl = URL.createObjectURL(file)
            } catch (error) {
                reject(error)
                return
            }
            const video = document.createElement("video")
            video.preload = "metadata"
            video.muted = true
            video.playsInline = true
            video.onloadedmetadata = () => {
                const capture = () => {
                    const width = video.videoWidth || 320
                    const height = video.videoHeight || 220
                    const coverUrl = this.makeVideoCover(video, width, height) || ""
                    resolve({
                        file,
                        previewUrl,
                        coverUrl,
                        width,
                        height,
                        duration: Math.max(1, Math.round(video.duration || 0)),
                        extension: this.videoExtension(file),
                    })
                }
                if (Number.isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = Math.min(0.1, video.duration / 2)
                    video.onseeked = capture
                } else {
                    capture()
                }
            }
            video.onerror = () => reject(new Error("video preview decode failed"))
            video.src = previewUrl
        })
    }

    makeImageThumb(image: HTMLImageElement) {
        const maxSize = 480
        const width = image.naturalWidth || image.width || maxSize
        const height = image.naturalHeight || image.height || maxSize
        const scale = Math.min(1, maxSize / Math.max(width, height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            return Promise.reject(new Error("canvas context unavailable"))
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        return Promise.resolve(canvas.toDataURL("image/jpeg", 0.72))
    }

    makeVideoCover(video: HTMLVideoElement, width: number, height: number) {
        try {
            const maxSize = 480
            const scale = Math.min(1, maxSize / Math.max(width, height))
            const canvas = document.createElement("canvas")
            canvas.width = Math.max(1, Math.round(width * scale))
            canvas.height = Math.max(1, Math.round(height * scale))
            const ctx = canvas.getContext("2d")
            if (!ctx) {
                return ""
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            return canvas.toDataURL("image/jpeg", 0.72)
        } catch (error) {
            return ""
        }
    }

    isImageFile(file?: File) {
        if (!file) {
            return false
        }
        if (file.type && file.type.startsWith("image/")) {
            return true
        }
        const ext = this.fileExtension(file.name)
        return !!ext && IMAGE_EXTS.includes(ext)
    }

    isVideoFile(file?: File) {
        if (!file) {
            return false
        }
        if (file.type && file.type.startsWith("video/")) {
            return true
        }
        const ext = this.fileExtension(file.name)
        return !!ext && VIDEO_EXTS.includes(ext)
    }

    fileExtension(name?: string) {
        const match = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/)
        return match ? match[1] : ""
    }

    imageExtension(file: File) {
        const byName = this.fileExtension(file.name)
        if (byName && IMAGE_EXTS.includes(byName)) {
            return `.${byName === "jpeg" ? "jpg" : byName}`
        }
        const byType = IMAGE_MIME_TO_EXT[file.type || ""]
        return `.${byType || "png"}`
    }

    videoExtension(file: File) {
        const byName = this.fileExtension(file.name)
        if (byName && VIDEO_EXTS.includes(byName)) {
            return `.${byName}`
        }
        const byType = VIDEO_MIME_TO_EXT[file.type || ""]
        return `.${byType || "mp4"}`
    }

    normalizeIncomingFiles(files: FileList | File[]) {
        return Array.from(files || []).filter((file) => !!file && file.size > 0).map((file, index) => {
            return this.isImageFile(file) ? this.normalizeImageFile(file, index) : file
        })
    }

    normalizeImageFile(file: File, index: number) {
        const existingExt = this.fileExtension(file.name)
        const mimeExt = IMAGE_MIME_TO_EXT[file.type || ""]
        const ext = existingExt && IMAGE_EXTS.includes(existingExt) ? (existingExt === "jpeg" ? "jpg" : existingExt) : (mimeExt || "png")
        const mimeType = file.type && file.type.startsWith("image/") ? file.type : (IMAGE_EXT_TO_MIME[ext] || "image/png")
        const hasUsableName = !!file.name && this.fileExtension(file.name) !== ""
        if (hasUsableName && file.type === mimeType) {
            return file
        }
        const safeName = hasUsableName ? file.name : `pasted-image-${Date.now()}-${index + 1}.${ext}`
        try {
            return new File([file], safeName, {
                type: mimeType,
                lastModified: file.lastModified || Date.now(),
            })
        } catch (error) {
            return file
        }
    }

    clipboardImageFiles(event: ClipboardEvent | any) {
        const clipboardData = event.clipboardData
        const files: File[] = []
        if (!clipboardData) {
            return files
        }
        const seen = new Set<string>()
        const pushFile = (file?: File | null) => {
            if (!file || file.size <= 0 || !this.isImageFile(file)) {
                return
            }
            const key = this.fileSignature(file)
            if (!seen.has(key)) {
                seen.add(key)
                files.push(file)
            }
        }
        Array.from(clipboardData.files || []).forEach((file: any) => pushFile(file))
        if (files.length === 0) {
            Array.from(clipboardData.items || []).forEach((item: any) => {
                if (item.kind === "file" && item.type?.startsWith("image/")) {
                    pushFile(item.getAsFile())
                }
            })
        }
        return this.normalizeIncomingFiles(files)
    }

    fileSignature(file: File) {
        if (!file.name || file.name.startsWith("pasted-image-")) {
            return `clipboard-image:${file.type || ""}:${file.size}`
        }
        return `${file.name || "clipboard-image"}:${file.type || ""}:${file.size}:${file.lastModified || 0}`
    }

    filesSignature(files: File[]) {
        return files.map((file) => this.fileSignature(file)).join("|")
    }

    registerSendInterceptor() {
        try {
            const inputContext = this.props.conversationContext.messageInputContext()
            if (!inputContext?.registerSendInterceptor) {
                setTimeout(() => this.registerSendInterceptor(), 0)
                return
            }
            inputContext.registerSendInterceptor(this.sendInterceptorKey, (text, mention) => {
                return this.sendPendingImages(text, mention)
            })
        } catch (error) {
            setTimeout(() => this.registerSendInterceptor(), 0)
        }
    }

    applyMention(content: any, mention?: MentionModel) {
        if (mention && (mention.all || (mention.uids && mention.uids.length > 0))) {
            content.mention = mention
        }
    }

    hasUsableImageItem(item?: Partial<ImagePreviewItem>) {
        return !!item?.file && item.file.size > 0 && !!item.previewUrl
    }

    validateImageItems(items?: ImagePreviewItem[]) {
        if (!items || items.length === 0) {
            Toast.warning("请选择图片后再发送")
            return false
        }
        const invalidIndex = items.findIndex((item) => !this.hasUsableImageItem(item))
        if (invalidIndex >= 0) {
            Toast.error("图片读取未完成，请重新选择图片")
            return false
        }
        return true
    }

    sendImageItem(item: ImagePreviewItem, caption = "", mention?: MentionModel) {
        if (!this.validateImageItems([item])) {
            return false
        }
        const { conversationContext } = this.props
        const content = new ImageContent(item.file, item.previewUrl, item.width, item.height, item.thumbUrl, caption)
        ;(content as any).extension = item.extension || this.imageExtension(item.file)
        this.applyMention(content, mention)
        conversationContext.sendMessage(content)
        return true
    }

    sendImageGroup(items: ImagePreviewItem[], caption = "", mention?: MentionModel) {
        if (!this.validateImageItems(items)) {
            return false
        }
        const { conversationContext } = this.props
        const content = new ImageGroupContent(items.map((item) => {
            return {
                file: item.file,
                imgData: item.previewUrl,
                thumb: item.thumbUrl,
                width: item.width,
                height: item.height,
                extension: item.extension || this.imageExtension(item.file),
            }
        }), caption)
        this.applyMention(content, mention)
        conversationContext.sendMessage(content)
        return true
    }

    sendPendingImages(caption = "", mention?: MentionModel) {
        const { fileType, imageItems } = this.state
        if (fileType !== "image" || !imageItems || imageItems.length === 0) {
            return false
        }
        const safeCaption = (caption || "").trim()
        let sent = false
        if (imageItems.length === 1) {
            sent = this.sendImageItem(imageItems[0], safeCaption, mention)
        } else {
            sent = this.sendImageGroup(imageItems, safeCaption, mention)
        }
        if (!sent) {
            return true
        }
        this.setState({
            fileType: undefined,
            file: undefined,
            previewUrl: undefined,
            width: undefined,
            height: undefined,
            canSend: false,
            imageItems: undefined,
        })
        this.imageCaption = ""
        return true
    }

    sendVideo(caption = "") {
        const { conversationContext } = this.props
        const { file, videoCover, width, height, duration } = this.state
        if (!file) {
            return
        }
        const content = new VideoContent(file, videoCover || "", width || 0, height || 0, duration || 0, caption)
        ;(content as any).extension = this.videoExtension(file)
        conversationContext.sendMessage(content)
    }

    onSend() {
        const {conversationContext} = this.props
        const {  file, previewUrl,width,height,fileType,imageItems } = this.state
        const caption = (this.imageCaption || "").trim()
        let sent = true
        if(fileType === "image") {
            if (imageItems && imageItems.length > 0) {
                if (imageItems.length === 1) {
                    sent = this.sendImageItem(imageItems[0], caption)
                } else {
                    sent = this.sendImageGroup(imageItems, caption)
                }
            } else {
                if (!this.hasUsableImageItem({ file, previewUrl })) {
                    Toast.error("图片读取未完成，请重新选择图片")
                    sent = false
                } else {
                    sent = this.sendImageItem({
                        file,
                        previewUrl,
                        width: width || 0,
                        height: height || 0,
                        extension: this.imageExtension(file),
                    }, caption)
                }
            }
        } else if(fileType === "video") {
            this.sendVideo(caption)
        } else if(fileType === "file") {
            conversationContext.sendMessage(new FileContent(file))
        }
        if (!sent) {
            return
        }
       
        this.setState({
            showDialog: false,
            imageItems: undefined,
            videoCover: undefined,
        });
        this.imageCaption = ""
    }
    onPreviewLoad(e: any) {
        let img = e.target;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        this.setState({
            width: width,
            height: height,
            canSend: true,
        });
    }
    cancelPendingImages() {
        this.setState({
            fileType: undefined,
            file: undefined,
            previewUrl: undefined,
            width: undefined,
            height: undefined,
            canSend: false,
            imageItems: undefined,
        })
        this.imageCaption = ""
    }

    sendInputMessage() {
        try {
            this.props.conversationContext.messageInputContext().send()
        } catch (error) {
            this.sendPendingImages("")
        }
    }

    renderInlineImageComposer() {
        const { imageItems, canSend } = this.state
        if (!imageItems || imageItems.length === 0) {
            return null
        }
        return <div className="wk-image-inline-composer">
            <div className="wk-image-inline-header">
                <span>待发送 {imageItems.length} 张图片</span>
                <button type="button" onClick={() => this.cancelPendingImages()}>清空</button>
            </div>
            <div className="wk-image-inline-list">
                {
                    imageItems.map((item, index) => {
                        return <div key={`${item.file.name}-${index}`} className="wk-image-inline-item">
                            <img alt="" src={item.thumbUrl || item.previewUrl} />
                            <button type="button" className="wk-image-inline-remove" onClick={() => this.removeImage(index)}>×</button>
                            <span>{index + 1}</span>
                        </div>
                    })
                }
                {
                    imageItems.length < MAX_IMAGE_COUNT ? (
                        <button type="button" className="wk-image-inline-add" onClick={() => this.$inlineAddInput?.click()}>
                            <span>+</span>
                            <em>添加</em>
                            <input ref={(ref) => { this.$inlineAddInput = ref }} type="file" accept="image/*" multiple={true} onClick={(event: any) => {
                                event.target.value = ''
                            }} onChange={(event: any) => {
                                this.showFiles(event.target.files)
                            }} />
                        </button>
                    ) : null
                }
            </div>
            <button type="button" className="wk-image-inline-send" disabled={!canSend} onClick={() => this.sendInputMessage()}>
                发送
            </button>
        </div>
    }

    render(): ReactNode {
        const { icon, accept, label } = this.props
        const { mode = "auto" } = this.props
        const { showDialog, canSend, fileIconInfo, file, fileType, previewUrl, imageItems, videoCover } = this.state
        return <div className="wk-imagetoolbar" >
            {this.renderInlineImageComposer()}
            <div className="wk-imagetoolbar-content" title={label || (mode === "file" ? "文件" : "图片")} onClick={() => {
            this.chooseFile()
        }}>
                <div className="wk-imagetoolbar-content-icon">
                    <img alt="" src={icon}></img>
                    {
                        label ? <span className="wk-imagetoolbar-content-label">{label}</span> : null
                    }
                    <input accept={accept} onClick={this.onFileClick} onChange={this.onFileChange.bind(this)} ref={(ref) => { this.$fileInput = ref }} type="file" multiple={mode !== "file"} style={{ display: 'none' }} />
                </div>
            </div>
            {
                showDialog ? (
                    <ImageDialog onCaptionChange={(caption) => { this.imageCaption = caption }} onAddImages={(files) => this.showFiles(files)} onRemoveImage={(index) => this.removeImage(index)} onSend={this.onSend.bind(this)} onLoad={this.onPreviewLoad.bind(this)} canSend={canSend} fileIconInfo={fileIconInfo} file={file} fileType={fileType} previewUrl={previewUrl} videoCover={videoCover} imageItems={imageItems} onClose={() => {
                        this.setState({
                            showDialog: !showDialog,
                            imageItems: undefined,
                            videoCover: undefined,
                        })
                        this.imageCaption = ""
                    }} />
                ) : null
            }
        </div>
    }
}


interface ImageDialogProps {
    onClose: () => void
    onSend?: () => void
    onCaptionChange?: (caption: string) => void
    fileType?: string // image, file
    previewUrl?: string
    file?: any
    fileIconInfo?: any,
    canSend?: boolean
    onLoad: (e: any) => void
    videoCover?: string
    imageItems?: ImagePreviewItem[]
    onAddImages?: (files: FileList | File[]) => void
    onRemoveImage?: (index: number) => void
}

class ImageDialog extends Component<ImageDialogProps> {
    $addInput: any


    // 格式化文件大小
    getFileSizeFormat(size: number) {
        if (size < 1024) {
            return `${size} B`
        }
        if (size > 1024 && size < 1024 * 1024) {
            return `${(size / 1024).toFixed(2)} KB`
        }
        if (size > 1024 * 1024 && size < 1024 * 1024 * 1024) {
            return `${(size / 1024 / 1024).toFixed(2)} M`
        }
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)}G`
    }

    render() {
        const { onClose, onSend, onCaptionChange, fileType, previewUrl, file, canSend, fileIconInfo, onLoad, videoCover, imageItems, onAddImages, onRemoveImage } = this.props
        const imageCount = imageItems?.length || 0
        return <div className="wk-imagedialog">
            <div className="wk-imagedialog-mask" onClick={onClose}></div>
            <div className="wk-imagedialog-content">
                <div className="wk-imagedialog-content-close" onClick={onClose}>
                    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2683" ><path d="M568.92178541 508.23169412l299.36805789-299.42461715a39.13899415 39.13899415 0 0 0 0-55.1452591L866.64962537 152.02159989a39.13899415 39.13899415 0 0 0-55.08869988 0L512.19286756 451.84213173 212.76825042 151.90848141a39.13899415 39.13899415 0 0 0-55.0886999 0L155.98277331 153.54869938a38.46028327 38.46028327 0 0 0 0 55.08869987L455.46394971 508.23169412 156.03933259 807.71287052a39.13899415 39.13899415 0 0 0 0 55.08869986l1.64021795 1.6967772a39.13899415 39.13899415 0 0 0 55.08869988 0l299.42461714-299.48117638 299.36805793 299.42461714a39.13899415 39.13899415 0 0 0 55.08869984 0l1.6967772-1.64021796a39.13899415 39.13899415 0 0 0 0-55.08869987L568.86522614 508.17513487z" p-id="2684"></path></svg>
                </div>
                <div className="wk-imagedialog-content-title">发送{fileType === 'image' ? (imageCount > 1 ? `${imageCount} 张图片` : '图片') : fileType === 'video' ? '视频' : '文件'}</div>
                <div className="wk-imagedialog-content-body">
                    {
                        fileType === 'image' ? (
                            <div className="wk-imagedialog-content-preview">
                                {
                                    imageItems ? (
                                        <div className="wk-imagedialog-content-previewWrap">
                                            <div className="wk-imagedialog-content-previewCount">共 {imageItems.length} 张，最多 100 张</div>
                                            <div className="wk-imagedialog-content-previewGrid">
                                            {
                                                imageItems.map((item, index) => {
                                                    return <div key={`${item.file.name}-${index}`} className="wk-imagedialog-content-previewItem">
                                                        <img alt="" className="wk-imagedialog-content-previewThumb" src={item.previewUrl} />
                                                        <button className="wk-imagedialog-content-removeBtn" onClick={(event) => {
                                                            event.stopPropagation()
                                                            if (onRemoveImage) {
                                                                onRemoveImage(index)
                                                            }
                                                        }}>×</button>
                                                        <span>{index + 1}</span>
                                                    </div>
                                                })
                                            }
                                            {
                                                imageItems.length < MAX_IMAGE_COUNT ? (
                                                    <button className="wk-imagedialog-content-addItem" onClick={() => {
                                                        this.$addInput?.click()
                                                    }}>
                                                        <span>+</span>
                                                        <em>添加</em>
                                                        <input ref={(ref) => { this.$addInput = ref }} type="file" accept="image/*" multiple={true} onClick={(event: any) => {
                                                            event.target.value = ''
                                                        }} onChange={(event: any) => {
                                                            if (onAddImages) {
                                                                onAddImages(event.target.files)
                                                            }
                                                        }} />
                                                    </button>
                                                ) : null
                                            }
                                            </div>
                                        </div>
                                    ) : (
                                        <img alt="" className="wk-imagedialog-content-previewImg" src={previewUrl} onLoad={onLoad} />
                                    )
                                }
                            </div>
                        ) : fileType === 'video' ? (
                            <div className="wk-imagedialog-content-preview">
                                <video className="wk-imagedialog-content-previewVideo" src={previewUrl} poster={videoCover} controls preload="metadata" />
                                <div className="wk-imagedialog-content-previewVideoMeta">
                                    <span>{file?.name}</span>
                                    <em>{this.getFileSizeFormat(file?.size || 0)}</em>
                                </div>
                            </div>
                        ) : (
                            <div className="wk-imagedialog-content-preview">
                                <div className="wk-imagedialog-content-preview-file">
                                    <div className="wk-imagedialog-content-preview-file-icon" style={{ backgroundColor: fileIconInfo?.color }}>
                                        <img alt="" className="wk-imagedialog-content-preview-file-thumbnail" src={fileIconInfo?.icon} />
                                    </div>
                                    <div className="wk-imagedialog-content-preview--filecontent">
                                        <div className="wk-imagedialog-content-preview--filecontent-name">{file?.name}</div>
                                        <div className="wk-imagedialog-content-preview--filecontent-size">{this.getFileSizeFormat(file?.size)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {
                        fileType === 'image' || fileType === 'video' ? (
                            <textarea className="wk-imagedialog-caption" maxLength={5000} placeholder="添加文字说明" onChange={(event) => {
                                if (onCaptionChange) {
                                    onCaptionChange(event.target.value)
                                }
                            }} />
                        ) : null
                    }
                    <div className="wk-imagedialog-footer" >
                        <button onClick={onClose}>取消</button>
                        <button onClick={onSend} className="wk-imagedialog-footer-okbtn" disabled={!canSend} style={{ backgroundColor: canSend ? WKApp.config.themeColor : 'gray' }}>发送</button>
                    </div>
                </div>

            </div>
        </div>
    }
}
