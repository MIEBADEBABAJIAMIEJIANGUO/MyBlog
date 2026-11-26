// 文件说明：全站网络请求 in-flight 计数，驱动顶部细进度条（非阻塞、带防闪烁时序）。

type Listener = (visible: boolean) => void;

let inFlight = 0;
let visible = false;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let shownAt = 0;

const listeners = new Set<Listener>();

/** 请求开始后延迟出现，避免快速响应闪一下进度条 */
const SHOW_DELAY_MS = 140;
/** 消失前的额外等待，让连续请求之间不闪烁 */
const HIDE_DELAY_MS = 180;
/** 一旦出现就至少停留这么久，避免「闪一下就没」的生硬感 */
const MIN_VISIBLE_MS = 420;

function now(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function notify() {
	for (const listener of listeners) listener(visible);
}

function scheduleShow() {
	if (hideTimer) {
		clearTimeout(hideTimer);
		hideTimer = undefined;
	}
	if (visible || showTimer) return;
	showTimer = setTimeout(() => {
		showTimer = undefined;
		if (inFlight > 0) {
			visible = true;
			shownAt = now();
			notify();
		}
	}, SHOW_DELAY_MS);
}

function scheduleHide() {
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = undefined;
	}
	if (!visible) return;
	if (hideTimer) clearTimeout(hideTimer);
	const remaining = MIN_VISIBLE_MS - (now() - shownAt);
	const wait = Math.max(HIDE_DELAY_MS, remaining);
	hideTimer = setTimeout(() => {
		hideTimer = undefined;
		if (inFlight === 0) {
			visible = false;
			notify();
		}
	}, wait);
}

/**
 * 开始一次全局 loading 计数。
 */
export function beginNetworkLoading(): void {
	inFlight += 1;
	if (inFlight === 1) scheduleShow();
}

/**
 * 结束一次全局 loading 计数。
 */
export function endNetworkLoading(): void {
	inFlight = Math.max(0, inFlight - 1);
	if (inFlight === 0) {
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = undefined;
		}
		scheduleHide();
	}
}

/**
 * 订阅进度条可见性变化。
 */
export function subscribeNetworkLoading(listener: Listener): () => void {
	listeners.add(listener);
	listener(visible);
	return () => listeners.delete(listener);
}

/**
 * 当前进行中的非 silent 请求数。
 */
export function getNetworkInFlight(): number {
	return inFlight;
}

/**
 * 进度条是否应显示（含 debounce）。
 */
export function isNetworkLoadingVisible(): boolean {
	return visible;
}
