// 文件说明：全局上传请求并发池，用信号量限制同时 in-flight 的 HTTP 请求数量。
/**
 * 轻量信号量，控制全局上传 HTTP 请求的并发上限。
 */
export class ConcurrencyPool {
	private active = 0;
	private readonly waitQueue: Array<() => void> = [];

	constructor(private readonly max: number) {}

	/**
	 * 等待并占用一个并发槽位。
	 */
	async acquire(): Promise<void> {
		if (this.active < this.max) {
			this.active++;
			return;
		}
		return new Promise((resolve) => {
			this.waitQueue.push(() => {
				this.active++;
				resolve();
			});
		});
	}

	/**
	 * 释放一个并发槽位并唤醒下一个等待者。
	 */
	release(): void {
		this.active--;
		const next = this.waitQueue.shift();
		if (next) next();
	}

	/**
	 * 在占用槽位期间执行异步任务，结束后自动释放。
	 */
	async run<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await fn();
		} finally {
			this.release();
		}
	}
}
