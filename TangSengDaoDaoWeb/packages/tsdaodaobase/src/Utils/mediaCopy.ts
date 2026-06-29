import { Toast } from "@douyinfe/semi-ui"

function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text)
    }
    return new Promise<void>((resolve, reject) => {
        const input = document.createElement("textarea")
        input.value = text
        input.style.position = "fixed"
        input.style.left = "-9999px"
        document.body.appendChild(input)
        input.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(input)
        ok ? resolve() : reject(new Error("copy failed"))
    })
}

function htmlEscape(text: string) {
    return text.replace(/[&<>"']/g, (char) => {
        const map: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
        }
        return map[char] || char
    })
}

function loadImageAsPng(url: string) {
    return new Promise<Blob>((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = "anonymous"
        image.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = image.naturalWidth || image.width
            canvas.height = image.naturalHeight || image.height
            const ctx = canvas.getContext("2d")
            if (!ctx) {
                reject(new Error("canvas context failed"))
                return
            }
            ctx.drawImage(image, 0, 0)
            canvas.toBlob((blob) => {
                blob ? resolve(blob) : reject(new Error("canvas blob failed"))
            }, "image/png")
        }
        image.onerror = reject
        image.src = url
    })
}

export async function copyImageURLToClipboard(imageURL?: string, text = "") {
    const safeURL = imageURL || ""
    const plainText = [text, safeURL].filter(Boolean).join("\n")
    if (!safeURL && !plainText) {
        Toast.error("没有可复制的图片")
        return
    }

    const clipboardItem = (window as any).ClipboardItem
    const html = safeURL ? `<img src="${htmlEscape(safeURL)}" />${text ? `<div>${htmlEscape(text).replace(/\n/g, "<br/>")}</div>` : ""}` : ""
    if (navigator.clipboard && clipboardItem) {
        try {
            const clipboardData: Record<string, Blob> = {}
            if (safeURL) {
                clipboardData["image/png"] = await loadImageAsPng(safeURL)
            }
            if (plainText) {
                clipboardData["text/plain"] = new Blob([plainText], { type: "text/plain" })
            }
            if (html) {
                clipboardData["text/html"] = new Blob([html], { type: "text/html" })
            }
            await (navigator.clipboard as any).write([new clipboardItem(clipboardData)])
            Toast.success("图片已复制")
            return
        } catch (error) {
            if (html) {
                try {
                    await (navigator.clipboard as any).write([new clipboardItem({
                        "text/html": new Blob([html], { type: "text/html" }),
                        "text/plain": new Blob([plainText], { type: "text/plain" }),
                    })])
                    Toast.success("图片链接已复制")
                    return
                } catch (htmlError) {
                    // fall through to text fallback
                }
            }
        }
    }

    try {
        await copyText(plainText || safeURL)
        Toast.success("图片链接已复制")
    } catch (error) {
        Toast.error("复制失败，请打开后手动复制")
    }
}
