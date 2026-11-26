// 文件说明：大文件分片并行调度器，在单文件内滑动窗口并发上传多个分片。
import type { ConcurrencyPool } from './concurrencyPool';
import { retryWithBackoff } from './retry';
import type { ProgressCallback } from './types';
import { MAX_CHUNK_RETRIES, RETRY_BASE_DELAY_MS } from './types';

export interface ChunkSchedulerOptions {
	uploadId: string;
	totalChunks: number;
	chunkSize: number;
	file: File;
	pool: ConcurrencyPool;
	maxConcurrentChunks: number;
	uploadChunkFn: (chunkIndex: number, blob: Blob) => Promise<void>;
	onProgress: ProgressCallback;
	chunkIndices?: number[];
	initialLoadedBytes?: number;
}

/**
 * 计算单个分片的字节大小。
 */
function getChunkBytes(chunkIndex: number, chunkSize: number, fileSize: number): number {
	const start = chunkIndex * chunkSize;
	return Math.min(chunkSize, fileSize - start);
}

/**
 * 并行上传指定分片，受单文件并发上限与全局请求池双重约束；单片失败自动重试。
 */
export function uploadChunksParallel(options: ChunkSchedulerOptions): Promise<void> {
	const {
		totalChunks,
		chunkSize,
		file,
		pool,
		maxConcurrentChunks,
		uploadChunkFn,
		onProgress,
		initialLoadedBytes = 0,
	} = options;

	const indices =
		options.chunkIndices ?? Array.from({ length: totalChunks }, (_, i) => i);
	const totalToUpload = indices.length;
	const totalBytes = file.size;
	let loadedBytes = initialLoadedBytes;

	let nextQueuePos = 0;
	let inFlight = 0;
	let completedCount = 0;
	let failed = false;
	let firstError: unknown = null;

	if (totalToUpload === 0) {
		onProgress(100, totalBytes, totalBytes);
		return Promise.resolve();
	}

	onProgress(
		Math.round((loadedBytes / totalBytes) * 100),
		loadedBytes,
		totalBytes,
	);

	return new Promise((resolve, reject) => {
		/**
		 * 检查是否全部完成或已全部失败且 in-flight 归零。
		 */
		function settle(): void {
			if (failed && inFlight === 0) {
				reject(firstError);
				return;
			}
			if (!failed && nextQueuePos >= totalToUpload && inFlight === 0) {
				resolve();
			}
		}

		/**
		 * 上传单片并在失败时指数退避重试。
		 */
		async function uploadOneChunk(chunkIndex: number, blob: Blob): Promise<void> {
			await retryWithBackoff(
				() => pool.run(() => uploadChunkFn(chunkIndex, blob)),
				MAX_CHUNK_RETRIES,
				RETRY_BASE_DELAY_MS,
			);
		}

		/**
		 * 尽可能多地派发分片任务，直到触达单文件并发上限或无待传分片。
		 */
		function dispatch(): void {
			while (!failed && inFlight < maxConcurrentChunks && nextQueuePos < totalToUpload) {
				const chunkIndex = indices[nextQueuePos++];
				inFlight++;

				const start = chunkIndex * chunkSize;
				const end = Math.min(start + chunkSize, file.size);
				const blob = file.slice(start, end);
				const chunkBytes = getChunkBytes(chunkIndex, chunkSize, file.size);

				void uploadOneChunk(chunkIndex, blob)
					.then(() => {
						if (failed) return;
						completedCount++;
						loadedBytes += chunkBytes;
						onProgress(
							Math.round((loadedBytes / totalBytes) * 100),
							loadedBytes,
							totalBytes,
						);
					})
					.catch((err) => {
						if (!failed) {
							failed = true;
							firstError = err;
						}
					})
					.finally(() => {
						inFlight--;
						if (!failed) {
							dispatch();
						}
						settle();
					});
			}
		}

		dispatch();
	});
}
