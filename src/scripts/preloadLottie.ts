// 文件说明：尽早预加载 DotLottie 播放器模块与 WASM，避免 loading 先显示圆环占位。
import type { ComponentType } from 'react';

type PlayerProps = {
	src: string;
	loop?: boolean;
	autoplay?: boolean;
	style?: React.CSSProperties;
};

let cachedPlayer: ComponentType<PlayerProps> | null = null;
let preloadPromise: Promise<void> | null = null;

/**
 * 预加载 Lottie 播放器（幂等，全站可多次调用）。
 */
export function preloadLottiePlayer(): Promise<void> {
	if (cachedPlayer) return Promise.resolve();
	if (!preloadPromise) {
		preloadPromise = (async () => {
			const [{ default: player }, { DotLottie }] = await Promise.all([
				import('../components/LottiePlayerCore'),
				import('@lottiefiles/dotlottie-web'),
			]);
			cachedPlayer = player;
			void DotLottie.preload();
		})();
	}
	return preloadPromise;
}

/**
 * 若预加载已完成，同步取得播放器组件。
 */
export function getCachedLottiePlayer(): ComponentType<PlayerProps> | null {
	return cachedPlayer;
}
