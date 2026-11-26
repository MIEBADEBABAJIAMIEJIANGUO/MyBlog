// 文件说明：localStorage 队列元数据持久化，配合 IndexedDB 实现刷新恢复。
import type { UploadItem } from './types';

const STORAGE_KEY = 'upload-queue-state';

/**
 * 将队列元数据写入 localStorage。
 */
export function saveQueue(queue: UploadItem[]): void {
	try {
		const data = queue.map(({ id, fileName, fileSize, status, progress, code, errorMessage, url, uploadId }) => ({
			id,
			fileName,
			fileSize,
			status,
			progress,
			code,
			errorMessage,
			url,
			uploadId,
		}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		/* quota exceeded — ignore */
	}
}

/**
 * 从 localStorage 读取队列元数据。
 */
export function loadQueue(): UploadItem[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as UploadItem[];
	} catch {
		return [];
	}
}

/**
 * 清空 localStorage 中的队列数据。
 */
export function clearQueue(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
