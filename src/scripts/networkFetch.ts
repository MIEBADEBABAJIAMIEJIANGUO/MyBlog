// 文件说明：包装 fetch，统一触发全局 loading 遮罩（可 silent）。

import { beginNetworkLoading, endNetworkLoading } from './networkLoadingStore';

export interface NetworkFetchOptions {
	/** 为 true 时不增加全局遮罩计数（SSE、轮询、已有内嵌 loading 等） */
	silent?: boolean;
}

/**
 * 与 fetch 相同，默认参与全局 loading；silent 时不触发遮罩。
 */
export async function networkFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
	options?: NetworkFetchOptions,
): Promise<Response> {
	const silent = options?.silent === true;
	if (!silent) beginNetworkLoading();
	try {
		return await fetch(input, init);
	} finally {
		if (!silent) endNetworkLoading();
	}
}
