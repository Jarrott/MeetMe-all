import classNames from "classnames";
import React from "react";
import { Component, ReactNode } from "react";
import { EndpointID } from "../../Service/Const";
import WKApp from "../../App";
import { Emoji, EmojiService } from "../../Service/EmojiService";
import ConversationContext from "../Conversation/context";
import { withStaticAssetVersion as withPackagedStaticAssetVersion } from "../../Utils/staticAsset";

import "./index.css"
import { LottieSticker } from "../../Messages/LottieSticker";

interface EmojiToolbarProps {
    conversationContext: ConversationContext
    icon: string
}

interface EmojiToolbarState {
    show: boolean
    animationStart: boolean
}

export default class EmojiToolbar extends Component<EmojiToolbarProps, EmojiToolbarState>{

    constructor(props: any) {
        super(props)
        this.state = {
            show: false,
            animationStart: false,
        }
    }

    render(): ReactNode {
        const { show, animationStart } = this.state
        const { icon, conversationContext } = this.props
        return <div className="wk-emojitoolbar" >
            <div className="wk-emojitoolbar-content" onClick={() => {
                this.setState({
                    show: !show,
                    animationStart: true
                })
            }}>
                <img src={icon}></img>
                <div onAnimationEnd={() => {
                    // this.setState({
                    //     animationStart: false
                    // })
                    if (!show) {
                        this.setState({
                            animationStart: false,
                        })
                    }
                }} className={classNames("wk-emojitoolbar-emojipanel", animationStart ? (show ? "wk-emojitoolbar-emojipanel-show" : "wk-emojitoolbar-emojipanel-hide") : undefined)}>
                    <EmojiPanel onSticker={(sticker) => {
                        this.setState({
                            show: false
                        })
                        const lottieSticker = new LottieSticker()
                        lottieSticker.category = sticker.category
                        lottieSticker.url = sticker.path
                        lottieSticker.placeholder = sticker.placeholder
                        lottieSticker.format = sticker.format
                        conversationContext.sendMessage(lottieSticker)
                    }} onEmoji={(emoji) => {
                        this.setState({
                            show: false
                        })
                        conversationContext.messageInputContext().insertText(emoji.key)
                    }}></EmojiPanel>
                </div>
            </div>
            {
                show ? <div className="wk-emojitoolbar-mask" onClick={()=>{
                    this.setState({
                        show: false,
                    })
                }}>
                </div> : undefined
            }

        </div>
    }
}

interface EmojiPanelState {
    emojis: Emoji[]
    category: string
    stickers: any[]
    customStickers: any[]
}

interface EmojiPanelProps {
    onEmoji?: (emoji: Emoji) => void
    onSticker?: (sticker: any) => void
}

var stickerCategories = new Array<any>()
const customStickerCategory = {
    category: "custom",
    cover: "",
    local: true,
    custom: true,
}
const localLegacyStickerCategory = {
    category: "local",
    cover: "/stickers/local/great.svg",
    local: true,
}
const localLegacyStickers = [
    { category: "local", path: "/stickers/local/received.svg", placeholder: "/stickers/local/received.svg", format: "image" },
    { category: "local", path: "/stickers/local/wait.svg", placeholder: "/stickers/local/wait.svg", format: "image" },
    { category: "local", path: "/stickers/local/thanks.svg", placeholder: "/stickers/local/thanks.svg", format: "image" },
    { category: "local", path: "/stickers/local/busy.svg", placeholder: "/stickers/local/busy.svg", format: "image" },
    { category: "local", path: "/stickers/local/go.svg", placeholder: "/stickers/local/go.svg", format: "image" },
    { category: "local", path: "/stickers/local/done.svg", placeholder: "/stickers/local/done.svg", format: "image" },
    { category: "local", path: "/stickers/local/read.svg", placeholder: "/stickers/local/read.svg", format: "image" },
    { category: "local", path: "/stickers/local/great.svg", placeholder: "/stickers/local/great.svg", format: "image" },
    { category: "local", path: "/stickers/local/ok.svg", placeholder: "/stickers/local/ok.svg", format: "image" },
    { category: "local", path: "/stickers/local/nice.svg", placeholder: "/stickers/local/nice.svg", format: "image" },
    { category: "local", path: "/stickers/local/onway.svg", placeholder: "/stickers/local/onway.svg", format: "image" },
    { category: "local", path: "/stickers/local/celebrate.svg", placeholder: "/stickers/local/celebrate.svg", format: "image" },
    { category: "local", path: "/stickers/local/sorry.svg", placeholder: "/stickers/local/sorry.svg", format: "image" },
    { category: "local", path: "/stickers/local/callme.svg", placeholder: "/stickers/local/callme.svg", format: "image" },
    { category: "local", path: "/stickers/local/coffee.svg", placeholder: "/stickers/local/coffee.svg", format: "image" },
    { category: "local", path: "/stickers/local/question.svg", placeholder: "/stickers/local/question.svg", format: "image" },
]
const meetMeStickerCounts: Record<string, number> = {
    meetme_reply: 48,
}
const meetMeStickerPrefix: Record<string, string> = {
    meetme_reply: "reply",
}
const localStickerCategories = [
    localLegacyStickerCategory,
    customStickerCategory,
    { category: "meetme_reply", cover: "/stickers/meetme/reply-cover.svg", local: true },
]
const localCategorySet = new Set(localStickerCategories.filter((item) => !item.custom).map((item) => item.category))
const customStickerStorageKey = "meetme-web-custom-stickers"
const staticAssetVersion = "20260628-sticker"

const withStaticAssetVersion = (url: string) => {
    return withPackagedStaticAssetVersion(url, staticAssetVersion)
}

const meetMeStickers = (category: string) => {
    const prefix = meetMeStickerPrefix[category]
    const count = meetMeStickerCounts[category] || 0
    if (!prefix || count <= 0) {
        return []
    }
    return Array.from({ length: count }, (_, index) => {
        const path = `/stickers/meetme/${prefix}-${String(index + 1).padStart(3, "0")}.svg`
        return {
            category,
            path,
            placeholder: path,
            format: "image",
        }
    })
}
export class EmojiPanel extends Component<EmojiPanelProps, EmojiPanelState> {
    emojiService: EmojiService

    constructor(props: any) {
        super(props)
        this.emojiService = WKApp.endpointManager.invoke(EndpointID.emojiService)
        this.state = {
            emojis: [],
            category: "emoji",
            stickers: [],
            customStickers: this.loadCustomStickers()
        }
    }

    componentDidMount() {
        this.setState({
            emojis: this.emojiService.getAllEmoji()
        })
        this.requestStickerCategory()
    }

    requestStickerCategory() {
        if (!stickerCategories || stickerCategories.length === 0) {
            WKApp.dataSource.commonDataSource.userStickerCategory().then((result) => {
                const remoteCategories = Array.isArray(result) ? result : []
                stickerCategories = [
                    ...localStickerCategories,
                    ...remoteCategories.filter((item: any) => item.category !== customStickerCategory.category && !localCategorySet.has(item.category)),
                ]
                this.setState({})
            }).catch(() => {
                stickerCategories = localStickerCategories
                this.setState({})
            })
        }
    }
    loadCustomStickers() {
        try {
            const raw = window.localStorage.getItem(customStickerStorageKey)
            const stickers = raw ? JSON.parse(raw) : []
            return Array.isArray(stickers) ? stickers : []
        } catch (error) {
            return []
        }
    }
    saveCustomStickers(stickers: any[]) {
        window.localStorage.setItem(customStickerStorageKey, JSON.stringify(stickers))
        this.setState({
            customStickers: stickers,
            stickers: this.state.category === customStickerCategory.category ? stickers : this.state.stickers,
        })
    }
    async addCustomSticker(file: File) {
        if (!file || !/^image\/(gif|png|jpeg|webp|jpg|svg\+xml)$/i.test(file.type)) {
            return
        }
        try {
            const commonDataSource = WKApp.dataSource.commonDataSource as any
            const path = await commonDataSource.uploadStickerFile(file)
            if (!path) {
                throw new Error("empty sticker path")
            }
            const sticker = await WKApp.dataSource.commonDataSource.addUserSticker({
                category: customStickerCategory.category,
                path,
                placeholder: path,
                format: "image",
                name: file.name,
            })
            this.setCustomStickersFromServer([...(this.state.customStickers || []), sticker].slice(-60))
        } catch (error) {
            const reader = new FileReader()
            reader.onload = () => {
                const stickers = [
                    ...this.state.customStickers,
                    {
                        category: customStickerCategory.category,
                        path: `${reader.result || ""}`,
                        placeholder: `${reader.result || ""}`,
                        format: "image",
                        name: file.name,
                        localOnly: true,
                        createdAt: Date.now(),
                    },
                ].slice(-60)
                this.saveCustomStickers(stickers)
            }
            reader.readAsDataURL(file)
        }
    }
    async removeCustomSticker(sticker: any) {
        if (sticker.id && !sticker.localOnly) {
            try {
                await WKApp.dataSource.commonDataSource.deleteUserSticker(sticker.id)
            } catch (error) {
                console.warn("delete user sticker failed", error)
            }
        }
        const stickers = this.state.customStickers.filter((item) => item.createdAt !== sticker.createdAt)
        this.saveCustomStickers(stickers)
    }
    setCustomStickersFromServer(stickers: any[]) {
        const normalized = (stickers || []).map((item) => ({
            ...item,
            category: item.category || customStickerCategory.category,
            placeholder: item.placeholder || item.path,
            format: item.format || "image",
            createdAt: item.createdAt || item.created_at || item.id || Date.now(),
        }))
        this.saveCustomStickers(normalized)
    }
    requestStickers(category: string) {
        if (category === localLegacyStickerCategory.category) {
            this.setState({
                stickers: localLegacyStickers,
            })
            return
        }
        if (category === customStickerCategory.category) {
            this.setState({
                stickers: this.state.customStickers,
            })
            WKApp.dataSource.commonDataSource.getStickers(category).then((result) => {
                const list = Array.isArray(result?.list) ? result.list : []
                this.setCustomStickersFromServer(list)
            }).catch(() => {
                this.setState({
                    stickers: this.state.customStickers,
                })
            })
            return
        }
        if (localCategorySet.has(category)) {
            this.setState({
                stickers: meetMeStickers(category),
            })
            return
        }
        WKApp.dataSource.commonDataSource.getStickers(category).then((result) => {
            this.setState({
                stickers: Array.isArray(result?.list) ? result.list : [],
            })
        }).catch(() => {
            this.setState({
                stickers: [],
            })
        })
    }

    resolveStickerURL(path: string) {
        if (!path) {
            return ""
        }
        if (path.startsWith("http") || path.startsWith("/") || path.startsWith("data:")) {
            return withStaticAssetVersion(path)
        }
        return WKApp.dataSource.commonDataSource.getFileURL(path)
    }

    renderStickerPreview(sticker: any) {
        const url = this.resolveStickerURL(sticker.path)
        if (sticker.format === "image") {
            return <img alt="" className="wk-emojipanel-sticker-image" src={url}></img>
        }
        return <tgs-player style={{ width: "74px", height: "74px" }} autoplay mode="normal" src={url}></tgs-player>
    }

    renderCustomStickerTools() {
        if (this.state.category !== customStickerCategory.category) {
            return null
        }
        return <>
            <li className="wk-emojipanel-custom-add">
                <label>
                    <span>+</span>
                    <em>添加</em>
                    <input type="file" accept="image/gif,image/png,image/jpeg,image/webp,image/svg+xml" multiple onChange={(event) => {
                        const files = Array.from(event.target.files || []).slice(0, 20)
                        for (const file of files) {
                            this.addCustomSticker(file)
                        }
                        event.currentTarget.value = ""
                    }} />
                </label>
            </li>
            {
                this.state.customStickers.length === 0 ? <li className="wk-emojipanel-custom-empty">添加常用图片或 GIF</li> : null
            }
        </>
    }

    render(): React.ReactNode {
        const { emojis, category, stickers } = this.state
        const { onEmoji, onSticker } = this.props
        return <div className="wk-emojipanel">
            <div className={classNames("wk-emojipanel-content", category !== "emoji" ? "wk-emojipanel-content-sticker" : undefined)}>
                <ul>
                    {
                        category === "emoji" ? emojis.map((emoji, i) => {
                            return <li key={i} onClick={(e) => {
                                e.stopPropagation()
                                if (onEmoji) {
                                    onEmoji(emoji)
                                }
                            }}>
                                {/* <img src={require(`./emoji/${emoji.image}`)}> </img> */}
                                <img src={emoji.image}></img>
                            </li>
                        }) : undefined
                    }
                    {
                        this.renderCustomStickerTools()
                    }
                    {
                        stickers && stickers.length > 0 && category !== "emoji" ? stickers.map((sticker) => {
                            return <li key={sticker.path} onClick={(e) => {
                                e.stopPropagation()
                                if (onSticker) {
                                    onSticker(sticker)
                                }
                            }}>
                                {this.renderStickerPreview(sticker)}
                                {
                                    category === customStickerCategory.category ? <button className="wk-emojipanel-custom-remove" onClick={(event) => {
                                        event.stopPropagation()
                                        this.removeCustomSticker(sticker)
                                    }}>×</button> : null
                                }
                            </li>
                        }) : undefined
                    }
                </ul>
            </div>
            <div className="wk-emojipanel-tab">
                <div className={classNames("wk-emojipanel-tab-item", category === "emoji" ? "wk-emojipanel-tab-item-selected" : undefined)} onClick={(e) => {
                    e.stopPropagation()
                    this.setState({ category: "emoji" })
                }}>
                    <img alt="" src={require("./emoji_tab_icon.png")}></img>
                </div>
                {
                    stickerCategories.map((stickerCategory) => {
                        return (
                            <div key={stickerCategory.category} className={classNames("wk-emojipanel-tab-item", stickerCategory.category === category ? "wk-emojipanel-tab-item-selected" : undefined)} onClick={(e) => {
                                e.stopPropagation()
                                const category: string = stickerCategory.category || ""
                                this.setState({ category: category })
                                this.requestStickers(category)

                            }}>
                                {
                                    stickerCategory.custom ? <span className="wk-emojipanel-tab-custom">我的</span> : <img alt="" src={this.resolveStickerURL(stickerCategory.cover)}></img>
                                }
                            </div>
                        )
                    })
                }
            </div>
        </div>
    }
}
