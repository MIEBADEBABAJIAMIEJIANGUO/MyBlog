// 文件说明：DotLottie 播放器（仅客户端动态 import，避免 SSR 加载 wasm）。
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface Props {
	src: string;
	loop?: boolean;
	autoplay?: boolean;
	style?: React.CSSProperties;
}

/**
 * 渲染 DotLottie 动画（WASM 预加载由 preloadLottiePlayer 负责）。
 */
export default function LottiePlayerCore({ src, loop = true, autoplay = true, style }: Props) {
	return <DotLottieReact src={src} loop={loop} autoplay={autoplay} style={style} />;
}
