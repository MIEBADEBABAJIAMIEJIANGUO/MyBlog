// 文件说明：可复用的 DotLottie loading 动画；无 CSS 圆环占位，依赖全站预加载直接出动画。
import { useEffect, useState, type ComponentType } from 'react';
import { LOTTIE_LOADING_SRC } from '../consts/lottie';
import { getCachedLottiePlayer, preloadLottiePlayer } from '../scripts/preloadLottie';

const SIZE_PX = { xs: 28, sm: 48, md: 96, lg: 140 } as const;

export type LottieLoadingSize = keyof typeof SIZE_PX;

interface Props {
	size?: LottieLoadingSize;
	label?: string;
	className?: string;
}

type PlayerProps = {
	src: string;
	loop?: boolean;
	autoplay?: boolean;
	style?: React.CSSProperties;
};

/**
 * 内嵌或遮罩内使用的 Lottie loading。
 */
export default function LottieLoading({ size = 'md', label, className = '' }: Props) {
	const px = SIZE_PX[size];
	const [Player, setPlayer] = useState<ComponentType<PlayerProps> | null>(() =>
		getCachedLottiePlayer(),
	);

	useEffect(() => {
		if (Player) return;
		let cancelled = false;
		void preloadLottiePlayer().then(() => {
			if (!cancelled) setPlayer(getCachedLottiePlayer());
		});
		return () => {
			cancelled = true;
		};
	}, [Player]);

	return (
		<div
			className={`lottie-loading flex flex-col items-center justify-center gap-2 ${className}`.trim()}
			role="status"
			aria-busy={!Player}
			aria-label={label ?? '加载中'}
		>
			{Player ? (
				<Player src={LOTTIE_LOADING_SRC} loop autoplay style={{ width: px, height: px }} />
			) : (
				/* 原占位：CSS 圆环 SpinnerOnly — 已移除，仅保留尺寸占位避免布局跳动 */
				<div style={{ width: px, height: px }} aria-hidden />
			)}
			{label ? <span className="lottie-loading-label text-sm text-gray-500">{label}</span> : null}
		</div>
	);
}
