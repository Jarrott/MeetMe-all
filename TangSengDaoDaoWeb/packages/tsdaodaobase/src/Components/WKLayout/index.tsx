import classNames from "classnames";
import React from "react";
import { Component } from "react";
import WKViewQueue, { WKViewQueueContext } from "../WKViewQueue";
import "./index.css"

const smallScreenWidth = 640 // 小屏最大宽度（index.css @media screen 里也需要改成这个值的大小）
const layoutLeftWidthStorageKey = "meetme_layout_left_width"
const layoutLeftMinWidth = 260
const layoutLeftMaxWidth = 520

export enum ScreenSize {
    normal,
    small
}

export interface WKLayoutProps {
    onRenderTab?: (size: ScreenSize) => JSX.Element
    contentLeft?: JSX.Element
    contentRight?:JSX.Element
    contentFull?: boolean
    onLeftContext?:(context:WKViewQueueContext)=>void
    onRightContext?:(context:WKViewQueueContext)=>void

}

export interface WKLayoutState {
    leftWidth?: number
    resizing: boolean
}

export class WKLayout extends Component<WKLayoutProps, WKLayoutState>{
    gResize!: (this: Window, ev: UIEvent) => any
    rightContext!: WKViewQueueContext
    routeLister!:VoidFunction
    layoutContentRef = React.createRef<HTMLDivElement>()
    handleLayoutResizeMouseMove = (event: MouseEvent) => {
        const contentRect = this.layoutContentRef.current?.getBoundingClientRect()
        if (!contentRect) {
            return
        }
        const maxWidth = Math.max(layoutLeftMinWidth, Math.min(layoutLeftMaxWidth, contentRect.width * 0.48))
        const nextWidth = Math.min(maxWidth, Math.max(layoutLeftMinWidth, event.clientX - contentRect.left))
        this.setState({
            leftWidth: nextWidth,
        })
    }
    handleLayoutResizeMouseUp = () => {
        window.removeEventListener("mousemove", this.handleLayoutResizeMouseMove)
        window.removeEventListener("mouseup", this.handleLayoutResizeMouseUp)
        document.body.classList.remove("wk-layout-resizing")
        if (this.state.leftWidth) {
            window.localStorage.setItem(layoutLeftWidthStorageKey, `${this.state.leftWidth}`)
        }
        this.setState({
            resizing: false,
        })
    }
    constructor(props: any) {
        super(props)
        this.gResize = this.resize.bind(this)
        const savedWidth = Number(window.localStorage.getItem(layoutLeftWidthStorageKey))
        this.state = {
            leftWidth: savedWidth >= layoutLeftMinWidth ? Math.min(savedWidth, layoutLeftMaxWidth) : undefined,
            resizing: false,
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.gResize)

        this.routeLister = ()=>{
            this.setState({})
        }
        this.rightContext.addRouteListener(this.routeLister)
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.gResize)
        window.removeEventListener("mousemove", this.handleLayoutResizeMouseMove)
        window.removeEventListener("mouseup", this.handleLayoutResizeMouseUp)
        document.body.classList.remove("wk-layout-resizing")
        this.rightContext.removeRouteListener(this.routeLister)
    }

    resize() {
        this.setState({})
    }

    handleLayoutResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (window.innerWidth <= smallScreenWidth || this.props.contentFull) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        document.body.classList.add("wk-layout-resizing")
        window.addEventListener("mousemove", this.handleLayoutResizeMouseMove)
        window.addEventListener("mouseup", this.handleLayoutResizeMouseUp)
        this.setState({
            resizing: true,
        })
    }

    render() {
        const { onRenderTab, contentLeft,contentRight,contentFull,onLeftContext,onRightContext } = this.props
        const leftStyle = this.state.leftWidth && !contentFull && window.innerWidth > smallScreenWidth ? {
            width: `${this.state.leftWidth}px`,
            flexBasis: `${this.state.leftWidth}px`,
        } : undefined
        return <div className="wk-layout">
            <div className="wk-layout-tab">
                {
                    onRenderTab && onRenderTab(window.innerWidth <= smallScreenWidth ? ScreenSize.small : ScreenSize.normal)
                }
            </div>
            <div ref={this.layoutContentRef} className={classNames("wk-layout-content",this.rightContext?.viewCount()>0?"wk-layout-open":undefined, contentFull ? "wk-layout-content-full-left" : undefined, this.state.resizing ? "wk-layout-content-resizing" : undefined)}>
                <div className="wk-layout-content-left" style={leftStyle}>
                    <WKViewQueue onContext={(context) => {
                        if(onLeftContext) {
                            onLeftContext(context)
                        }
                    }}>
                        {contentLeft}
                    </WKViewQueue>
                    <div className="wk-layout-content-resizer" onMouseDown={this.handleLayoutResizeMouseDown}></div>
                </div>
                <div className="wk-layout-content-right">
                    <WKViewQueue onContext={(context) => {
                        this.rightContext = context
                        if(onRightContext) {
                            onRightContext(context)
                        }
                    }}>
                        {contentRight}
                    </WKViewQueue>
                </div>
            </div>
        </div>
    }
}
