// 文件说明：单文件上传逻辑，使用 XHR 以支持 upload.onprogress 进度回调。
import type { ConcurrencyPool } from './concurrencyPool';
import { retryWithBackoff } from './retry';
import type { ApiResponse, ProgressCallback, UploadedFileInfo } from './types';
import { getApiBase, MAX_CHUNK_RETRIES, RETRY_BASE_DELAY_MS } from './types';

/**
 * 执行一次 XHR 单文件上传。
 */
function doUploadSingle(
	file: File,
	onProgress: ProgressCallback,
): Promise<UploadedFileInfo> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();
		formData.append('file', file);
		const total = file.size;

		xhr.upload.addEventListener('progress', (e) => {
			if (e.lengthComputable) {
				onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
			} else {
				onProgress(Math.round((e.loaded / total) * 100), e.loaded, total);
			}
		});

		xhr.addEventListener('load', () => {
			try {
				const data = JSON.parse(xhr.responseText) as ApiResponse<UploadedFileInfo>;
				if (xhr.status >= 200 && xhr.status < 300 && data.success && data.data) {
					onProgress(100, total, total);
					resolve(data.data);
				} else {
					reject({ code: data.code, message: data.message });
				}
			} catch {
				reject({ code: -1, message: 'Invalid server response' });
			}
		});

		xhr.addEventListener('error', () => {
			reject({ code: -1, message: 'Network error' });
		});

		xhr.open('POST', `${getApiBase()}/api/upload`);
		xhr.send(formData);
	});
}

/**
 * 通过 XHR 上传单个文件（≤ FILE_CHUNK_MAXSIZE），失败自动重试。
 */
export function uploadSingle(
	file: File,
	onProgress: ProgressCallback,
	pool: ConcurrencyPool,
): Promise<UploadedFileInfo> {
	return retryWithBackoff(
		() => pool.run(() => doUploadSingle(file, onProgress)),
		MAX_CHUNK_RETRIES,
		RETRY_BASE_DELAY_MS,
	);
}
