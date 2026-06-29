import { MessageContent } from "wukongimjssdk"
import React from "react"
import WKApp from "../../App"
import { MessageContentTypeConst } from "../../Service/Const"
import MessageBase from "../Base"
import { MessageCell } from "../MessageCell"
import "@lottiefiles/lottie-player/dist/tgs-player";
import "./index.css";
import { withStaticAssetVersion as withPackagedStaticAssetVersion } from "../../Utils/staticAsset"



export class LottieSticker extends MessageContent {
    url!: string
    category!: string
    placeholder!: string
    format!: string
    decodeJSON(content: any) {
        this.url = content["url"] || ""
        this.category = content["category"] || ""
        this.placeholder = content["placeholder"] || ""
        this.format = content["format"] || ""
    }
    get conversationDigest() {

        return "[贴图]"
    }
    encodeJSON() {
        
        return {url:this.url||"",category:this.category||"",placeholder:this.placeholder||"",format:this.format||""}
    }
    get contentType() {
        return MessageContentTypeConst.lottieSticker
    }
    
}


declare global {
    namespace JSX {
        interface IntrinsicElements {
            "tgs-player": any;
        }
    }
}

export class LottieStickerCell extends MessageCell {
    withStaticAssetVersion(url: string) {
        const version = "20260628-sticker"
        return withPackagedStaticAssetVersion(url, version)
    }

    resolveStickerURL(url: string) {
        if (!url) {
            return ""
        }
        if (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:")) {
            return this.withStaticAssetVersion(url)
        }
        return WKApp.dataSource.commonDataSource.getImageURL(url)
    }

    isImageSticker(content: LottieSticker) {
        const url = content.url || ""
        return content.format === "image" || /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(url)
    }


    render() {

        const { message, context } = this.props
        const content = message.content as LottieSticker
        const url = this.resolveStickerURL(content.url)
        return <MessageBase hiddeBubble={true} message={message} context={context} >
            {
                this.isImageSticker(content) ? (
                    <img alt="" className="wk-message-sticker-image" src={url}></img>
                ) : (
                    <tgs-player style={{ width: "auto", height: "208px" }} autoplay loop mode="normal" src={url}></tgs-player>
                )
            }
        </MessageBase>
    }
}
