// 文件说明：上传进度追踪器，根据已传字节估算速度与剩余时间。
/**
 * 滑动窗口采样上传速度并估算 ETA。
 */
export class ProgressTracker {
	private samples: Array<{ t: number; bytes: number }> = [];
	private readonly maxSamples = 5;

	constructor(
		private readonly totalBytes: number,
		private initialBytes = 0,
	) {
		if (initialBytes > 0) {
			this.samples.push({ t: Date.now(), bytes: initialBytes });
		}
	}

	/**
	 * 更新已传字节数并返回速度与 ETA 文本。
	 */
	update(loadedBytes: number): { speedText: string; etaText: string } {
		const now = Date.now();
		this.samples.push({ t: now, bytes: loadedBytes });
		if (this.samples.length > this.maxSamples) {
			this.samples.shift();
		}

		let speedBps = 0;
		if (this.samples.length >= 2) {
			const first = this.samples[0];
			const last = this.samples[this.samples.length - 1];
			const dt = (last.t - first.t) / 1000;
			const db = last.bytes - first.bytes;
			if (dt > 0 && db > 0) speedBps = db / dt;
		}

		const speedText = formatSpeed(speedBps);
		let etaText = '--';
		if (speedBps > 0 && loadedBytes < this.totalBytes) {
			const remaining = (this.totalBytes - loadedBytes) / speedBps;
			etaText = formatEta(remaining);
		} else if (loadedBytes >= this.totalBytes) {
			etaText = '0s';
		}

		return { speedText, etaText };
	}
}

/**
 * 将字节/秒格式化为可读速度字符串。
 */
function formatSpeed(bps: number): string {
	if (bps <= 0) return '0 B/s';
	if (bps < 1024) return `${Math.round(bps)} B/s`;
	if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
	return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * 将剩余秒数格式化为可读 ETA 字符串。
 */
function formatEta(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '--';
	if (seconds < 60) return `${Math.ceil(seconds)}s`;
	const m = Math.floor(seconds / 60);
	const s = Math.ceil(seconds % 60);
	return `${m}m ${s}s`;
}
