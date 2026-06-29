import { WKApp } from "@tsdaodao/base";
import axios, { Canceler } from "axios";
import { Toast } from "@douyinfe/semi-ui";
import { MediaMessageContent } from "wukongimjssdk";
import {  MessageTask, TaskStatus } from "wukongimjssdk";



export class MediaMessageUploadTask extends MessageTask {
    private _progress?:number
    private canceler: Canceler | undefined
    private canceled = false
    constructor(message: any) {
        super(message)
        ;(message as any).uploadTask = this
    }
    getUUID(){
        var len=32;//32长度
        var radix=16;//16进制
        var chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');var uuid=[],i;radix=radix||chars.length;if(len){for(i=0;i<len;i++)uuid[i]=chars[0|Math.random()*radix];}else{var r;uuid[8]=uuid[13]=uuid[18]=uuid[23]='-';uuid[14]='4';for(i=0;i<36;i++){if(!uuid[i]){r=0|Math.random()*16;uuid[i]=chars[(i===19)?(r&0x3)|0x8:r];}}}
        return uuid.join('');
      }

    async start(): Promise<void> {
        const mediaContent = this.message.content as MediaMessageContent
        if (this.isImageGroupContent(mediaContent)) {
            await this.uploadImageGroup(mediaContent)
            return
        }
        if(mediaContent.file) {
            const param = new FormData();
            param.append("file", mediaContent.file);
            const fileName = this.getUUID();
            const path = `/${this.message.channel.channelType}/${this.message.channel.channelID}/${fileName}${mediaContent.extension??""}`
            const uploadURL = await  this.getUploadURL(path)
            if(uploadURL) {
                await this.uploadFile(mediaContent.file,uploadURL)

            }else{
                console.log('获取上传地址失败！')
                this.status = TaskStatus.fail
                this.update()
            }
        }else {
            console.log('多媒体消息不存在附件！');
            if (mediaContent.remoteUrl && mediaContent.remoteUrl !== "") {
                this.status = TaskStatus.success
                this.update()
            } else {
                this.status = TaskStatus.fail
                this.update()
            }
        }
    }

    isImageGroupContent(content: any) {
        return content?.contentType === 21 && Array.isArray(content?.images)
    }

    async uploadImageGroup(content: any) {
        const images = content.images || []
        if (images.length === 0) {
            this.status = TaskStatus.fail
            this.update()
            return
        }
        try {
            for (let index = 0; index < images.length; index++) {
                const item = images[index]
                if (!item.url && item.file) {
                    const ext = item.extension || this.fileExtension(item.file.name) || ".png"
                    const path = `/${this.message.channel.channelType}/${this.message.channel.channelID}/${this.getUUID()}${ext}`
                    const uploadURL = await this.getUploadURL(path)
                    if (!uploadURL) {
                        throw new Error("missing upload url")
                    }
                    const resp = await this.uploadFileToPath(item.file, path, uploadURL)
                    if (!resp?.path) {
                        throw new Error("missing uploaded image path")
                    }
                    item.url = resp.path
                }
                this._progress = Math.min(0.99, (index + 1) / images.length)
                this.update()
            }
            content.remoteUrl = images.find((item: any) => item.url)?.url || "image-group"
            content.file = undefined
            this._progress = 1
            this.status = TaskStatus.success
            this.update()
        } catch (error) {
            console.log("多图上传失败！->", error)
            Toast.error("图片上传失败，请稍后重试")
            this.status = TaskStatus.fail
            this.update()
        }
    }

    async uploadFileToPath(file: File, path: string, uploadURL?: string) {
        if (this.shouldUseChunkUpload(file)) {
            const uploadedPath = await this.uploadFileByChunks(file, path, false)
            return uploadedPath ? { path: uploadedPath } : undefined
        }
        if (!uploadURL) {
            uploadURL = await this.getUploadURL(path)
        }
        if (!uploadURL) {
            throw new Error("missing upload url")
        }
        const param = new FormData()
        param.append("file", file)
        param.append("contenttype", file.type || this.inferContentType(file.name) || "application/octet-stream")
        const resp = await axios.post(uploadURL, param, {
            headers: { "Content-Type": "multipart/form-data" },
            cancelToken: new axios.CancelToken((c: Canceler) => {
                this.canceler = c
            }),
            onUploadProgress: e => {
                if (e.total) {
                    this._progress = Math.min(0.99, e.loaded / e.total)
                    this.update()
                }
            }
        })
        return resp.data
    }

   async uploadFile(file:File,uploadURL:string) {
        if (this.shouldUseChunkUpload(file)) {
            await this.uploadFileByChunks(file)
            return
        }
        const param = new FormData();
        param.append("file", file);
        param.append("contenttype", file.type || this.inferContentType(file.name) || "application/octet-stream");
        const resp = await axios.post(uploadURL,param,{
            headers: { "Content-Type": "multipart/form-data" },
            cancelToken: new axios.CancelToken((c: Canceler) => {
                this.canceler = c
            }),
            onUploadProgress: e => {
                if (e.total) {
                    this._progress = Math.min(0.99, e.loaded / e.total)
                    this.update()
                }
            }
        }).catch(error => {
            console.log('文件上传失败！->', error);
            if (error?.response?.status === 413) {
                Toast.error("文件太大，上传通道已拒绝，请压缩后再发送")
            } else {
                Toast.error("文件上传失败，请稍后重试")
            }
            this.status = TaskStatus.fail
            this.update()
        })
        if(resp) {
            if(resp.data.path) {
                const mediaContent = this.message.content as MediaMessageContent
                mediaContent.remoteUrl = resp.data.path
                ;(mediaContent as any).url = resp.data.path
                this.status = TaskStatus.success
                this.update()
            } else {
                this.status = TaskStatus.fail
                this.update()
            }
        }
    }

    // 获取上传路径
    async getUploadURL(path:string) :Promise<string|undefined> {
       const result = await WKApp.apiClient.get(`file/upload?path=${path}&type=chat`)
       if(result) {
           return this.normalizeUploadURL(result.url)
       }
    }

    normalizeUploadURL(uploadURL?: string) {
        if (!uploadURL) {
            return uploadURL
        }
        if (typeof window !== "undefined" && window.location?.protocol === "https:" && uploadURL.indexOf("http://") === 0) {
            return uploadURL.replace("http://", "https://")
        }
        return uploadURL
    }

    inferContentType(name?: string) {
        const ext = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
        const map: Record<string, string> = {
            mp4: "video/mp4",
            m4v: "video/x-m4v",
            mov: "video/quicktime",
            webm: "video/webm",
            ogv: "video/ogg",
            ogg: "video/ogg",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
        }
        return ext ? map[ext] : undefined
    }

    fileExtension(name?: string) {
        const ext = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
        return ext ? `.${ext}` : undefined
    }

    shouldUseChunkUpload(file: File) {
        return file.size > 20 * 1024 * 1024
    }

    async uploadFileByChunks(file: File, uploadPath?: string, updateMessageContent = true) {
        const mediaContent = this.message.content as MediaMessageContent
        const chunkSize = 8 * 1024 * 1024
        const totalChunks = Math.ceil(file.size / chunkSize)
        const finalUploadPath = uploadPath || `/${this.message.channel.channelType}/${this.message.channel.channelID}/${this.getUUID()}${mediaContent.extension ?? ""}`
        const contentType = file.type || this.inferContentType(file.name) || "application/octet-stream"
        try {
            const initResp = await WKApp.apiClient.post("file/chunk/init", {
                type: "chat",
                path: finalUploadPath,
                contenttype: contentType,
                size: file.size,
                chunk_size: chunkSize,
                total_chunks: totalChunks,
            })
            const uploadID = initResp?.upload_id
            const chunkURL = this.normalizeUploadURL(initResp?.chunk_url)
            if (!uploadID || !chunkURL) {
                throw new Error("missing chunk upload info")
            }
            for (let index = 0; index < totalChunks; index++) {
                if (this.canceled) {
                    this.status = TaskStatus.cancel
                    this.update()
                    return
                }
                const start = index * chunkSize
                const end = Math.min(file.size, start + chunkSize)
                const param = new FormData()
                param.append("upload_id", uploadID)
                param.append("index", `${index}`)
                param.append("file", file.slice(start, end), `${index}.part`)
                await axios.post(chunkURL, param, {
                    headers: { "Content-Type": "multipart/form-data" },
                    cancelToken: new axios.CancelToken((c: Canceler) => {
                        this.canceler = c
                    }),
                    onUploadProgress: e => {
                        if (e.total) {
                            const currentChunkProgress = e.loaded / e.total
                            this._progress = Math.min(0.99, (index + currentChunkProgress) / totalChunks)
                            this.update()
                        }
                    },
                })
                this._progress = Math.min(0.99, (index + 1) / totalChunks)
                this.update()
            }
            const completeResp = await WKApp.apiClient.post("file/chunk/complete", {
                upload_id: uploadID,
                type: "chat",
                path: finalUploadPath,
                contenttype: contentType,
                total_chunks: totalChunks,
            })
            if (!completeResp?.path) {
                throw new Error("missing completed file path")
            }
            if (updateMessageContent) {
                mediaContent.remoteUrl = completeResp.path
                ;(mediaContent as any).url = completeResp.path
            }
            this._progress = 1
            if (updateMessageContent) {
                this.status = TaskStatus.success
                this.update()
            }
            return completeResp.path
        } catch (error: any) {
            console.log("分片上传失败！->", error)
            Toast.error("文件上传失败，请稍后重试")
            this.status = TaskStatus.fail
            this.update()
            return undefined
        }
    }

    suspend(): void {
    }
    resume(): void {
       
    }
    cancel(): void {
        this.canceled = true
        this.status = TaskStatus.cancel
        if(this.canceler) {
            this.canceler()
        }
        this.update()
    }
    progress(): number {
        return this._progress??0
    }

}
