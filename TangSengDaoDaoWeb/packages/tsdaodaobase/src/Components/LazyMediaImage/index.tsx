import React from "react";

interface LazyMediaImageProps {
  src?: string;
  fallbackSrc?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  rootMargin?: string;
  placeholder?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLImageElement | HTMLDivElement>;
}

interface LazyMediaImageState {
  shouldLoad: boolean;
  failed: boolean;
  currentSrc?: string;
}

export default class LazyMediaImage extends React.PureComponent<LazyMediaImageProps, LazyMediaImageState> {
  private containerRef = React.createRef<HTMLDivElement>();
  private observer?: IntersectionObserver;

  constructor(props: LazyMediaImageProps) {
    super(props);
    this.state = {
      shouldLoad: false,
      failed: false,
      currentSrc: props.src,
    };
  }

  componentDidMount() {
    if (!this.props.src) {
      return;
    }
    if (!("IntersectionObserver" in window)) {
      this.setState({ shouldLoad: true });
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
        return;
      }
      this.setState({ shouldLoad: true });
      this.disconnectObserver();
    }, {
      rootMargin: this.props.rootMargin || "480px 0px",
    });
    if (this.containerRef.current) {
      this.observer.observe(this.containerRef.current);
    }
  }

  componentDidUpdate(prevProps: LazyMediaImageProps) {
    if (prevProps.src !== this.props.src) {
      this.disconnectObserver();
      this.setState({
        shouldLoad: false,
        failed: false,
        currentSrc: this.props.src,
      }, () => this.componentDidMount());
    }
  }

  componentWillUnmount() {
    this.disconnectObserver();
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  renderPlaceholder() {
    if (this.props.placeholder) {
      return this.props.placeholder;
    }
    return <div style={{
      ...this.props.style,
      background: "rgba(0,0,0,.06)",
      color: "#999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
    }} onClick={this.props.onClick}>图片加载中</div>;
  }

  renderFailed() {
    return <div style={{
      ...this.props.style,
      background: "rgba(0,0,0,.06)",
      color: "#999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
    }} onClick={this.props.onClick}>图片加载失败</div>;
  }

  render() {
    const { alt = "", className, style, fallbackSrc, onClick } = this.props;
    const { shouldLoad, failed, currentSrc } = this.state;
    if (!currentSrc) {
      return this.renderFailed();
    }
    if (!shouldLoad) {
      return <div ref={this.containerRef} className={className} style={style} onClick={onClick}>
        {this.renderPlaceholder()}
      </div>;
    }
    if (failed) {
      return this.renderFailed();
    }
    return <img
      alt={alt}
      className={className}
      src={currentSrc}
      loading="lazy"
      decoding="async"
      style={style}
      onClick={onClick as React.MouseEventHandler<HTMLImageElement>}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          this.setState({ currentSrc: fallbackSrc });
          return;
        }
        this.setState({ failed: true });
      }}
    />;
  }
}
