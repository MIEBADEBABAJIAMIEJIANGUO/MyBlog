// 文件说明：全站网络请求顶部细进度条（非阻塞），替代原先「全屏白幕 + 大 Lottie」的遮罩。
import { useEffect, useState } from 'react';
import { subscribeNetworkLoading } from '../scripts/networkLoadingStore';
import '../styles/network-loading.css';

/** 退出过渡时长，需不小于 CSS 中的 opacity 过渡时间 */
const EXIT_MS = 320;

/**
 * 挂载于 Layout：有进行中的请求时，在页面顶部滑出一条细进度条。
 * 不遮挡、不模糊、不拦截点击，因此不会再出现「白屏闪一下」的生硬感。
 */
export default function GlobalNetworkLoading() {
	const [visible, setVisible] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => subscribeNetworkLoading(setVisible), []);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			return;
		}
		if (!mounted) return;
		const timer = setTimeout(() => setMounted(false), EXIT_MS);
		return () => clearTimeout(timer);
	}, [visible, mounted]);

	if (!mounted) return null;

	return (
		<div className="network-progress" data-state={visible ? 'visible' : 'hidden'} aria-hidden="true">
			<div className="network-progress__bar" />
		</div>
	);
}
