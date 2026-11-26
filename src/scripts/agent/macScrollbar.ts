// 文件说明：macOS 风格滚动条行为，滚动时短暂显示、停止后自动隐藏。

/** 滚动条激活态 class，配合 agent-scrollbar.css */
export const MAC_SCROLLBAR_ACTIVE_CLASS = 'agent-chat-scroll--active';

const DEFAULT_IDLE_MS = 800;
const TIMER_KEY = 'macScrollbarTimer';

/**
 * 延迟移除滚动条激活态。
 */
function scheduleHide(element: HTMLElement, idleMs: number) {
	const prev = element.dataset[TIMER_KEY];
	if (prev) clearTimeout(Number(prev));
	const id = setTimeout(() => {
		element.classList.remove(MAC_SCROLLBAR_ACTIVE_CLASS);
		delete element.dataset[TIMER_KEY];
	}, idleMs);
	element.dataset[TIMER_KEY] = String(id);
}

/**
 * 手动或滚动时触发滚动条显示，静止 idleMs 后隐藏。
 */
export function revealMacScrollbar(element: HTMLElement, idleMs = DEFAULT_IDLE_MS) {
	element.classList.add(MAC_SCROLLBAR_ACTIVE_CLASS);
	scheduleHide(element, idleMs);
}

/**
 * 为可滚动容器绑定 mac 式滚动条：滚动时显示，静止 idleMs 后隐藏。
 */
export function attachMacScrollbar(element: HTMLElement, idleMs = DEFAULT_IDLE_MS) {
	const onScroll = () => revealMacScrollbar(element, idleMs);
	element.addEventListener('scroll', onScroll, { passive: true });
	return () => {
		element.removeEventListener('scroll', onScroll);
		const prev = element.dataset[TIMER_KEY];
		if (prev) clearTimeout(Number(prev));
		delete element.dataset[TIMER_KEY];
		element.classList.remove(MAC_SCROLLBAR_ACTIVE_CLASS);
	};
}
