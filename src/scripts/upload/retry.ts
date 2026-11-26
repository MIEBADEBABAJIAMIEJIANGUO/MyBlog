// 文件说明：上传请求失败重试工具，支持指数退避等待。
/**
 * 延迟指定毫秒。
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 对异步函数执行有限次重试，失败间隔指数退避。
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries: number,
	baseDelayMs: number,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				await sleep(baseDelayMs * 2 ** attempt);
			}
		}
	}
	throw lastError;
}
