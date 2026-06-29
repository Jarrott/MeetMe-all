const localAssetPrefixes = ["/emoji/", "/stickers/", "/identity_icon/"]

export const isPackagedStaticAssetEnv = () => {
    if (typeof window === "undefined") {
        return false
    }
    const win = window as any
    return window.location.protocol === "file:" || !!win.__POWERED_ELECTRON__ || !!win.__TAURI_IPC__ || !!win.electronAPI
}

export const resolveStaticAssetURL = (url: string) => {
    if (!url) {
        return ""
    }
    if (/^(https?:|data:|blob:|file:)/i.test(url)) {
        return url
    }
    if (!localAssetPrefixes.some((prefix) => url.startsWith(prefix))) {
        return url
    }
    if (isPackagedStaticAssetEnv()) {
        return `.${url}`
    }
    return url
}

export const withStaticAssetVersion = (url: string, version: string) => {
    if (!url || !localAssetPrefixes.some((prefix) => url.startsWith(prefix))) {
        return url
    }
    const versioned = url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`
    return resolveStaticAssetURL(versioned)
}
