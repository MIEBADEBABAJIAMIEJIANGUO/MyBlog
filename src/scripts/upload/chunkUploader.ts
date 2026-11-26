// 文件说明：大文件分片上传逻辑，init → 并行分片上传（支持断点续传）→ merge。
import type { ConcurrencyPool } from './concurrencyPool';
import { uploadChunksParallel } from './chunkScheduler';
import type {
	ApiResponse,
	ChunkProgress,
	ProgressCallback,
	UploadConfig,
	UploadedFileInfo,
} from './types';
import { networkFetch } from '../networkFetch';
import { getApiBase, MAX_CONCURRENT_CHUNKS } from './types';

interface ChunkInitData {
	uploadId: string;
	totalChunks: number;
}

/**
 * 解析 API JSON 响应，失败时抛出带 code 的错误。
 */
async function parseResponse<T>(res: Response): Promise<T> {
	const data = (await res.json()) as ApiResponse<T>;
	if (!res.ok || !data.success) {
		throw { code: data.code, message: data.message };
	}
	return data.data as T;
}

/**
 * 上传单个分片。
 */
async function uploadChunk(
	uploadId: string,
	chunkIndex: number,
	totalChunks: number,
	blob: Blob,
): Promise<void> {
	const formData = new FormData();
	formData.append('uploadId', uploadId);
	formData.append('chunkIndex', String(chunkIndex));
	formData.append('totalChunks', String(totalChunks));
	formData.append('chunk', blob, `chunk-${chunkIndex}`);

	const res = await networkFetch(`${getApiBase()}/api/upload/chunk`, {
		method: 'POST',
		body: formData,
	}, { silent: true });
	await parseResponse(res);
}

/**
 * 查询服务端已上传的分片进度。
 */
export async function fetchChunkProgress(
	uploadId: string,
	pool: ConcurrencyPool,
): Promise<ChunkProgress | null> {
	try {
		return await pool.run(async () => {
			const res = await networkFetch(`${getApiBase()}/api/upload/chunk/${uploadId}/progress`, undefined, {
				silent: true,
			});
			return parseResponse<ChunkProgress>(res);
		});
	} catch {
		return null;
	}
}

/**
 * 分片上传完整流程，支持 resumeUploadId 断点续传。
 */
export async function uploadChunked(
	file: File,
	config: UploadConfig,
	onProgress: ProgressCallback,
	pool: ConcurrencyPool,
	resumeUploadId?: string,
): Promise<{ fileInfo: UploadedFileInfo; uploadId: string }> {
	const session = await resolveChunkSession(file, pool, resumeUploadId, config.FILE_CHUNK_SIZE);
	const { uploadId, totalChunks, missingIndices, initialLoadedBytes } = session;
	const chunkSize = config.FILE_CHUNK_SIZE;

	try {
		await uploadChunksParallel({
			uploadId,
			totalChunks,
			chunkSize,
			file,
			pool,
			// 原代码注释：maxConcurrentChunks: MAX_CONCURRENT_CHUNKS,
			maxConcurrentChunks: config.MAX_CONCURRENT_CHUNKS ?? MAX_CONCURRENT_CHUNKS,
			uploadChunkFn: (chunkIndex, blob) => uploadChunk(uploadId, chunkIndex, totalChunks, blob),
			onProgress,
			chunkIndices: missingIndices,
			initialLoadedBytes,
		});

		const fileInfo = await pool.run(async () => {
			const mergeRes = await networkFetch(`${getApiBase()}/api/upload/chunk/merge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uploadId }),
			}, { silent: true });
			return parseResponse<UploadedFileInfo>(mergeRes);
		});

		return { fileInfo, uploadId };
	} catch (err) {
		const e = err as { code?: number; message?: string };
		throw { code: e.code, message: e.message, uploadId };
	}
}

/**
 * 计算若干分片的总字节数。
 */
function sumChunkBytes(
	indices: number[],
	chunkSize: number,
	fileSize: number,
): number {
	return indices.reduce(
		(sum, i) => sum + Math.min(chunkSize, fileSize - i * chunkSize),
		0,
	);
}

/**
 * 初始化或恢复分片会话，返回待上传分片列表。
 */
async function resolveChunkSession(
	file: File,
	pool: ConcurrencyPool,
	resumeUploadId: string | undefined,
	chunkSize: number,
): Promise<{
	uploadId: string;
	totalChunks: number;
	missingIndices: number[];
	initialLoadedBytes: number;
}> {
	if (resumeUploadId) {
		const progress = await fetchChunkProgress(resumeUploadId, pool);
		if (progress && progress.uploadedChunks.length < progress.totalChunks) {
			const uploadedSet = new Set(progress.uploadedChunks);
			const missingIndices = Array.from({ length: progress.totalChunks }, (_, i) => i).filter(
				(i) => !uploadedSet.has(i),
			);
			return {
				uploadId: progress.uploadId,
				totalChunks: progress.totalChunks,
				missingIndices,
				initialLoadedBytes: sumChunkBytes(
					progress.uploadedChunks,
					chunkSize,
					file.size,
				),
			};
		}
	}

	const initData = await pool.run(async () => {
		const initRes = await networkFetch(`${getApiBase()}/api/upload/chunk/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				fileSize: file.size,
				mimeType: file.type || 'application/octet-stream',
			}),
		}, { silent: true });
		return parseResponse<ChunkInitData>(initRes);
	});

	const totalChunks = initData.totalChunks;
	return {
		uploadId: initData.uploadId,
		totalChunks,
		missingIndices: Array.from({ length: totalChunks }, (_, i) => i),
		initialLoadedBytes: 0,
	};
}

/**
 * 取消分片上传并清理服务端临时目录。
 */
export async function cancelChunkUpload(uploadId: string): Promise<void> {
	await networkFetch(`${getApiBase()}/api/upload/chunk/${uploadId}`, { method: 'DELETE' }, { silent: true });
}
