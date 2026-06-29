import React from "react"
import { Component } from "react"
import AvatarEditor from "react-avatar-editor"
import "./index.css"



interface WKAvatarEditorProps {
    file: any
}

interface WKAvatarEditorState {
    scale: number
    rotate: number
}

export  class WKAvatarEditor extends Component<WKAvatarEditorProps, WKAvatarEditorState> {
    editor?: AvatarEditor|null

    constructor(props: WKAvatarEditorProps) {
        super(props)
        this.state = {
            scale: 1,
            rotate: 0,
        }
    }

    getImageScaledToCanvas(): HTMLCanvasElement|undefined {
        return this.editor?.getImageScaledToCanvas()
    }

    render(): React.ReactNode {
        const { file } = this.props
        const { scale, rotate } = this.state
        return <div className="wk-avatar-editor">
            <div className="wk-avatar-editor-canvas">
                <AvatarEditor
                    ref={(rf)=>{
                        this.editor = rf
                    }}
                    image={file}
                    width={320}
                    height={320}
                    border={36}
                    color={[255, 255, 255, 0.64]} // RGBA
                    borderRadius={320}
                    scale={scale}
                    rotate={rotate}
                />
            </div>
            <div className="wk-avatar-editor-controls">
                <div className="wk-avatar-editor-control">
                    <span>缩放</span>
                    <input type="range" min="0.5" max="3" step="0.01" value={scale} onChange={(event) => {
                        this.setState({ scale: Number(event.target.value) })
                    }} />
                    <em>{Math.round(scale * 100)}%</em>
                </div>
                <div className="wk-avatar-editor-actions">
                    <button onClick={() => this.setState({ scale: 1, rotate: 0 })}>重置</button>
                    <button onClick={() => this.setState({ rotate: (rotate + 270) % 360 })}>左转</button>
                    <button onClick={() => this.setState({ rotate: (rotate + 90) % 360 })}>右转</button>
                </div>
            </div>
        </div>
    }
}
