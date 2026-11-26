// 文件说明：文件上传页面编排入口，负责配置拉取、任务队列、进度与列表 UI 更新。
import { uploadSingle } from './upload/singleUploader';
import { uploadChunked, cancelChunkUpload } from './upload/chunkUploader';
import { ConcurrencyPool } from './upload/concurrencyPool';
import { deleteFile as deleteStoredFile, getFile as getStoredFile, saveFile as saveStoredFile } from './upload/fileStore';
import { ProgressTracker } from './upload/progressTracker';
import { loadQueue, saveQueue } from './upload/queuePersist';
import type {
	UploadConfig,
	UploadItem,
	UploadLabels,
	UploadedFileInfo,
	ApiResponse,
} from './upload/types';
import {
	getApiBase,
	setApiBase,
	MAX_CONCURRENT_UPLOADS,
	MAX_GLOBAL_IN_FLIGHT,
} from './upload/types';
import { normalizeFilename } from './upload/filename';
import { validateFile } from './upload/validate';
import { networkFetch } from './networkFetch';

/**
 * 将字节数格式化为可读的文件大小字符串。
 */
function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 用占位符替换文案模板中的变量。
 */
function fillTemplate(template: string, vars: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * 生成唯一任务 ID。
 */
function createId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 检测上传后端是否在线。
 */
async function checkServerHealth(): Promise<boolean> {
	try {
		const res = await networkFetch(`${getApiBase()}/api/health`, { method: 'GET' });
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * 拉取上传配置。
 */
async function fetchConfig(): Promise<UploadConfig | null> {
	try {
		const res = await networkFetch(`${getApiBase()}/api/upload/config`);
		const data = (await res.json()) as ApiResponse<UploadConfig>;
		if (data.success && data.data) return data.data;
	} catch {
		/* ignore */
	}
	return null;
}

/**
 * 拉取已上传文件列表。
 */
async function fetchUploadedList(): Promise<UploadedFileInfo[]> {
	try {
		const res = await networkFetch(`${getApiBase()}/api/upload/list`);
		const data = (await res.json()) as ApiResponse<{ files: UploadedFileInfo[] }>;
		if (data.success && data.data) return data.data.files;
	} catch {
		/* ignore */
	}
	return [];
}

/**
 * 初始化上传体验组件：绑定选文件、提交、队列与已上传列表。
 */
export async function initUploadExperience(root: HTMLElement): Promise<void> {
	if (root.dataset.apiBase) {
		setApiBase(root.dataset.apiBase);
	}

	const labelsJson = root.dataset.labels;
	if (!labelsJson) return;

	const labels = JSON.parse(labelsJson) as UploadLabels;

	const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
	const fileInput = root.querySelector<HTMLInputElement>('[data-file-input]');
	const selectBtn = root.querySelector<HTMLButtonElement>('[data-select-btn]');
	const submitBtn = root.querySelector<HTMLButtonElement>('[data-submit-btn]');
	const fileInfo = root.querySelector<HTMLElement>('[data-file-info]');
	const validationEl = root.querySelector<HTMLElement>('[data-validation-errors]');
	const queueToolbar = root.querySelector<HTMLElement>('[data-queue-toolbar]');
	const queueEl = root.querySelector<HTMLElement>('[data-upload-queue]');
	const listEl = root.querySelector<HTMLElement>('[data-upload-list]');
	const toastEl = root.querySelector<HTMLElement>('[data-toast]');

	if (
		!dropzone ||
		!fileInput ||
		!selectBtn ||
		!submitBtn ||
		!fileInfo ||
		!validationEl ||
		!queueToolbar ||
		!queueEl ||
		!listEl
	) {
		return;
	}

	let config: UploadConfig | null = await fetchConfig();
	// 原代码注释：const uploadPool = new ConcurrencyPool(MAX_GLOBAL_IN_FLIGHT);
	const uploadPool = new ConcurrencyPool(
		config?.MAX_GLOBAL_IN_FLIGHT ?? MAX_GLOBAL_IN_FLIGHT,
	);
	let selectedFiles: File[] = [];
	let activeUploadCount = 0;
	const queue: UploadItem[] = [];
	const uploadedFiles: UploadedFileInfo[] = [];
	const taskFiles = new Map<string, File>();
	const progressTrackers = new Map<string, ProgressTracker>();
	let persistTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * debounce 持久化队列到 localStorage。
	 */
	function schedulePersistQueue(): void {
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			saveQueue(queue);
		}, 500);
	}

	/**
	 * 显示短暂 toast 提示。
	 */
	function showToast(message: string): void {
		if (!toastEl) return;
		toastEl.textContent = message;
		toastEl.classList.remove('hidden');
		setTimeout(() => toastEl.classList.add('hidden'), 2000);
	}

	/**
	 * 渲染上传任务队列与工具栏。
	 */
	function renderQueue(): void {
		const successCount = queue.filter((q) => q.status === 'success').length;
		if (successCount > 0) {
			queueToolbar.classList.remove('hidden');
			queueToolbar.innerHTML = `<button type="button" data-clear-completed class="text-sm text-indigo-600 hover:underline">${fillTemplate(labels.clearCompleted, { count: String(successCount) })}</button>`;
			queueToolbar.querySelector('[data-clear-completed]')?.addEventListener('click', () => {
				clearCompletedItems();
			});
		} else {
			queueToolbar.classList.add('hidden');
			queueToolbar.innerHTML = '';
		}

		if (queue.length === 0) {
			queueEl.innerHTML = '';
			queueEl.classList.add('hidden');
			return;
		}
		queueEl.classList.remove('hidden');
		queueEl.innerHTML = queue
			.map((item) => {
				const statusLabel =
					item.status === 'uploading'
						? labels.statusUploading
						: item.status === 'success'
							? labels.statusSuccess
							: item.status === 'failed'
								? labels.statusFailed
								: item.status === 'pending'
									? labels.statusPending
									: '';
				const statusClass =
					item.status === 'success'
						? 'bg-green-100 text-green-800'
						: item.status === 'failed'
							? 'bg-red-100 text-red-800'
							: item.status === 'uploading'
								? 'bg-blue-100 text-blue-800'
								: item.status === 'pending'
									? 'bg-gray-100 text-gray-500'
									: 'bg-gray-100 text-gray-600';
				const errorHtml =
					item.status === 'failed' && item.errorMessage
						? `<p class="mt-1 text-xs text-red-600">${fillTemplate(labels.errorCode, {
								code: String(item.code ?? ''),
								message: item.errorMessage,
							})}</p>`
						: '';
				const removeBtn =
					item.status === 'failed'
						? `<button type="button" data-remove-id="${item.id}" class="text-xs text-red-600 hover:underline ml-2">${labels.remove}</button>`
						: '';
				const retryBtn =
					item.status === 'failed' && taskFiles.has(item.id)
						? `<button type="button" data-retry-id="${item.id}" class="text-xs text-indigo-600 hover:underline">${labels.retry}</button>`
						: '';
				const previewLink =
					item.status === 'success' && item.url
						? `<a href="${getApiBase()}${item.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 hover:underline ml-2">${labels.preview}</a>`
						: '';
				const showProgress = item.status === 'uploading' || item.status === 'pending';
				const speedEtaHtml =
					item.status === 'uploading' && item.speedText
						? `<p class="mt-1 text-xs text-gray-500">${fillTemplate(labels.speedEta, {
								speed: item.speedText,
								eta: item.etaText ?? '--',
							})}</p>`
						: '';
				return `
				<div class="border border-gray-200 rounded-lg p-4 mb-3 bg-white" data-queue-item="${item.id}">
					<div class="flex items-center justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-gray-900 truncate">${normalizeFilename(item.fileName)}</p>
							<p class="text-xs text-gray-500">${formatFileSize(item.fileSize)}</p>
						</div>
						<span class="text-xs px-2 py-0.5 rounded-full shrink-0 ${statusClass}">${statusLabel}</span>
					</div>
					${showProgress ? `
					<div class="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
						<div class="h-full bg-indigo-600 transition-all duration-300" style="width:${item.progress}%"></div>
					</div>
					<p class="mt-1 text-xs text-gray-500">${fillTemplate(labels.progress, { percent: String(item.progress) })}</p>
					${speedEtaHtml}
					` : ''}
					${errorHtml}
					<div class="mt-2">${retryBtn}${removeBtn}${previewLink}</div>
				</div>`;
			})
			.join('');

		queueEl.querySelectorAll('[data-remove-id]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = (btn as HTMLElement).dataset.removeId;
				if (id) void removeQueueItem(id);
			});
		});

		queueEl.querySelectorAll('[data-retry-id]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = (btn as HTMLElement).dataset.retryId;
				if (id) void retryQueueItem(id);
			});
		});
	}

/**
 * 构建文件访问 URL（预览/复制链接）。
 */
function buildFileAccessUrl(file: UploadedFileInfo): string {
	const path = file.url?.startsWith('/')
		? file.url
		: `/api/files/${encodeURIComponent(file.filename)}/preview`;
	return `${getApiBase()}${path}`;
}

/**
 * 渲染已上传文件列表。
 */
function renderUploadedList(): void {
	listEl.removeAttribute('aria-busy');
	if (uploadedFiles.length === 0) {
		listEl.innerHTML = `<p class="text-sm text-gray-500">${labels.emptyList}</p>`;
		return;
	}
	listEl.innerHTML = uploadedFiles
		.map(
			(f) => {
				const fileUrl = buildFileAccessUrl(f);
				return `
			<div class="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-4 py-3 mb-2 bg-gray-50">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-gray-900 truncate">${normalizeFilename(f.originalName)}</p>
					<p class="text-xs text-gray-500">${formatFileSize(f.size)} · ${new Date(f.uploadedAt).toLocaleString()}</p>
				</div>
				<div class="flex shrink-0 gap-2">
					<button type="button" data-copy-url="${f.filename}" data-file-url="${fileUrl}" class="text-sm text-indigo-600 hover:underline">${labels.copyLink}</button>
					<a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline">${labels.preview}</a>
					<button type="button" data-delete-file="${f.filename}" class="text-sm text-red-600 hover:underline">${labels.delete}</button>
				</div>
			</div>`;
			},
		)
		.join('');

		listEl.querySelectorAll('[data-copy-url]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const url = (btn as HTMLElement).dataset.fileUrl;
				if (url) {
					void navigator.clipboard.writeText(url).then(() => showToast(labels.copied));
				}
			});
		});

		listEl.querySelectorAll('[data-delete-file]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const filename = (btn as HTMLElement).dataset.deleteFile;
				if (filename && confirm(labels.deleteConfirm)) {
					void deleteUploadedFile(filename);
				}
			});
		});
	}

	/**
	 * 更新队列中某条任务的字段并重新渲染。
	 */
	function updateItem(id: string, patch: Partial<UploadItem>): void {
		const idx = queue.findIndex((q) => q.id === id);
		if (idx >= 0) {
			queue[idx] = { ...queue[idx], ...patch };
			renderQueue();
			schedulePersistQueue();
		}
	}

	/**
	 * 将成功上传的文件追加到已上传列表。
	 */
	function addToUploadedList(fileInfo: UploadedFileInfo): void {
		uploadedFiles.unshift({
			...fileInfo,
			originalName: normalizeFilename(fileInfo.originalName),
		});
		renderUploadedList();
	}

	/**
	 * 删除已上传文件。
	 */
	async function deleteUploadedFile(filename: string): Promise<void> {
		try {
			const res = await networkFetch(`${getApiBase()}/api/upload/${encodeURIComponent(filename)}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as ApiResponse;
			if (!res.ok || !data.success) return;
			const idx = uploadedFiles.findIndex((f) => f.filename === filename);
			if (idx >= 0) uploadedFiles.splice(idx, 1);
			renderUploadedList();
		} catch {
			/* ignore */
		}
	}

	/**
	 * 清除队列中所有已成功项。
	 */
	function clearCompletedItems(): void {
		const toRemove = queue.filter((q) => q.status === 'success');
		for (const item of toRemove) {
			void deleteStoredFile(item.id);
			taskFiles.delete(item.id);
			progressTrackers.delete(item.id);
		}
		for (let i = queue.length - 1; i >= 0; i--) {
			if (queue[i].status === 'success') queue.splice(i, 1);
		}
		renderQueue();
		schedulePersistQueue();
	}

	/**
	 * 移除失败任务，若有分片 uploadId 则通知服务端清理。
	 */
	async function removeQueueItem(id: string): Promise<void> {
		const item = queue.find((q) => q.id === id);
		if (!item) return;
		if (item.uploadId) {
			try {
				await cancelChunkUpload(item.uploadId);
			} catch {
				/* ignore cleanup errors */
			}
		}
		const idx = queue.indexOf(item);
		queue.splice(idx, 1);
		taskFiles.delete(id);
		progressTrackers.delete(id);
		void deleteStoredFile(id);
		renderQueue();
		schedulePersistQueue();
	}

	/**
	 * 重试失败任务：分片任务断点续传，小文件整文件重传。
	 */
	async function retryQueueItem(id: string): Promise<void> {
		const item = queue.find((q) => q.id === id);
		const file = taskFiles.get(id);
		if (!item || !file || item.status !== 'failed') return;

		const online = await checkServerHealth();
		if (!online) {
			updateItem(id, { errorMessage: labels.serverOffline });
			return;
		}

		if (!config) {
			config = await fetchConfig();
		}
		if (!config) {
			updateItem(id, { errorMessage: labels.serverOffline });
			return;
		}

		updateItem(id, {
			status: 'pending',
			progress: item.progress,
			code: undefined,
			errorMessage: undefined,
			speedText: undefined,
			etaText: undefined,
		});
		processUploadQueue();
	}

	/**
	 * 同批次内按文件名+大小去重，保留第一个。
	 */
	function dedupeFiles(files: File[]): File[] {
		const seen = new Set<string>();
		return files.filter((file) => {
			const key = `${file.name}-${file.size}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	/**
	 * 渲染校验失败提示。
	 */
	function renderValidationErrors(errors: Array<{ name: string; reason: string }>): void {
		if (errors.length === 0) {
			validationEl.classList.add('hidden');
			validationEl.innerHTML = '';
			return;
		}
		validationEl.classList.remove('hidden');
		validationEl.innerHTML = `<p class="text-sm font-medium text-red-700 mb-1">${labels.validationFailed}</p>${errors
			.map((e) => `<p class="text-xs text-red-600">${e.name}: ${e.reason}</p>`)
			.join('')}`;
	}

	/**
	 * 选中多个文件后更新 UI（含预校验）。
	 */
	function handleFilesSelected(files: File[]): void {
		if (files.length === 0) return;

		const errors: Array<{ name: string; reason: string }> = [];
		const validFiles: File[] = [];

		for (const file of files) {
			if (config) {
				const result = validateFile(file, config);
				if (!result.valid) {
					errors.push({ name: file.name, reason: result.reason ?? labels.error });
					continue;
				}
			}
			validFiles.push(file);
		}

		renderValidationErrors(errors);
		if (validFiles.length === 0) return;

		selectedFiles = dedupeFiles([...selectedFiles, ...validFiles]);
		const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
		const displayFiles = selectedFiles.slice(0, 5);
		const itemsHtml = displayFiles
			.map((file) =>
				fillTemplate(labels.fileInfoItem, {
					name: file.name,
					size: formatFileSize(file.size),
				}),
			)
			.join('<br>');
		const moreCount = selectedFiles.length - displayFiles.length;
		const moreHtml =
			moreCount > 0
				? `<br>${fillTemplate(labels.fileInfoMore, { count: String(moreCount) })}`
				: '';
		fileInfo.innerHTML = `${fillTemplate(labels.fileInfo, {
			count: String(selectedFiles.length),
			size: formatFileSize(totalSize),
		})}<br><span class="text-gray-500">${itemsHtml}${moreHtml}</span>`;
		fileInfo.classList.remove('hidden');
		submitBtn.disabled = false;
	}

	/**
	 * 清空已选文件展示区。
	 */
	function clearSelectedFiles(): void {
		selectedFiles = [];
		fileInfo.classList.add('hidden');
		fileInfo.innerHTML = '';
		fileInput.value = '';
		submitBtn.disabled = true;
		renderValidationErrors([]);
	}

	/**
	 * 持久化任务文件到 IndexedDB。
	 */
	async function persistTaskFile(itemId: string, file: File): Promise<void> {
		try {
			await saveStoredFile(itemId, file);
		} catch {
			/* 超大文件可能超出配额，忽略 */
		}
	}

	/**
	 * 执行单个上传任务（单文件或分片）。
	 */
	async function runUploadTask(itemId: string, file: File): Promise<void> {
		if (!config) return;

		const queueItem = queue.find((q) => q.id === itemId);
		const resumeUploadId = queueItem?.uploadId;

		activeUploadCount++;
		const tracker = new ProgressTracker(file.size, 0);
		progressTrackers.set(itemId, tracker);

		updateItem(itemId, { status: 'uploading', progress: queueItem?.progress ?? 0 });

		const onProgress = (percent: number, loaded: number, total: number) => {
			const { speedText, etaText } = tracker.update(loaded);
			updateItem(itemId, { progress: percent, speedText, etaText });
		};

		try {
			if (file.size <= config.FILE_CHUNK_MAXSIZE) {
				const fileInfoResult = await uploadSingle(file, onProgress, uploadPool);
				updateItem(itemId, {
					status: 'success',
					progress: 100,
					url: fileInfoResult.url,
					code: 0,
					uploadId: undefined,
				});
				addToUploadedList(fileInfoResult);
				taskFiles.delete(itemId);
				void deleteStoredFile(itemId);
			} else {
				const { fileInfo: fileInfoResult, uploadId } = await uploadChunked(
					file,
					config,
					onProgress,
					uploadPool,
					resumeUploadId,
				);
				updateItem(itemId, {
					status: 'success',
					progress: 100,
					url: fileInfoResult.url,
					uploadId,
					code: 0,
				});
				addToUploadedList(fileInfoResult);
				taskFiles.delete(itemId);
				void deleteStoredFile(itemId);
			}
		} catch (err) {
			const e = err as { code?: number; message?: string; uploadId?: string };
			updateItem(itemId, {
				status: 'failed',
				code: e.code,
				errorMessage: e.message ?? labels.error,
				uploadId: e.uploadId ?? resumeUploadId,
			});
		} finally {
			progressTrackers.delete(itemId);
			activeUploadCount--;
			processUploadQueue();
		}
	}

	/**
	 * 从 pending 队列中取出任务，最多 MAX_CONCURRENT_UPLOADS 路并行上传。
	 */
	function processUploadQueue(): void {
		const maxConcurrentUploads = config?.MAX_CONCURRENT_UPLOADS ?? MAX_CONCURRENT_UPLOADS;
		// 原代码注释：while (activeUploadCount < MAX_CONCURRENT_UPLOADS) {
		while (activeUploadCount < maxConcurrentUploads) {
			const pendingItem = queue.find((q) => q.status === 'pending');
			if (!pendingItem) break;

			const file = taskFiles.get(pendingItem.id);
			if (!file) {
				updateItem(pendingItem.id, {
					status: 'failed',
					errorMessage: labels.restoreFailed,
				});
				continue;
			}

			void runUploadTask(pendingItem.id, file);
		}
	}

	/**
	 * 批量提交上传：入队 pending 任务并启动调度器。
	 */
	async function uploadFiles(): Promise<void> {
		if (selectedFiles.length === 0) return;

		const filesToUpload = dedupeFiles([...selectedFiles]);
		clearSelectedFiles();

		const online = await checkServerHealth();
		if (!online) {
			for (const file of filesToUpload) {
				const itemId = createId();
				queue.unshift({
					id: itemId,
					fileName: file.name,
					fileSize: file.size,
					status: 'failed',
					progress: 0,
					code: -1,
					errorMessage: labels.serverOffline,
				});
				taskFiles.set(itemId, file);
				void persistTaskFile(itemId, file);
			}
			renderQueue();
			schedulePersistQueue();
			return;
		}

		if (!config) {
			config = await fetchConfig();
		}
		if (!config) {
			for (const file of filesToUpload) {
				const itemId = createId();
				queue.unshift({
					id: itemId,
					fileName: file.name,
					fileSize: file.size,
					status: 'failed',
					progress: 0,
					code: -1,
					errorMessage: labels.serverOffline,
				});
				taskFiles.set(itemId, file);
				void persistTaskFile(itemId, file);
			}
			renderQueue();
			schedulePersistQueue();
			return;
		}

		for (const file of filesToUpload) {
			const itemId = createId();
			const validation = validateFile(file, config);
			if (!validation.valid) {
				queue.unshift({
					id: itemId,
					fileName: file.name,
					fileSize: file.size,
					status: 'failed',
					progress: 0,
					code: validation.code,
					errorMessage: validation.reason ?? labels.error,
				});
				continue;
			}

			queue.unshift({
				id: itemId,
				fileName: file.name,
				fileSize: file.size,
				status: 'pending',
				progress: 0,
			});
			taskFiles.set(itemId, file);
			void persistTaskFile(itemId, file);
		}

		renderQueue();
		schedulePersistQueue();
		processUploadQueue();
	}

	/**
	 * 从 localStorage + IndexedDB 恢复未完成任务。
	 */
	async function restoreQueueFromStorage(): Promise<void> {
		const saved = loadQueue();
		if (saved.length === 0) return;

		for (const item of saved) {
			if (item.status === 'success') {
				queue.push(item);
				continue;
			}

			const file = await getStoredFile(item.id);
			if (!file && item.status !== 'failed') {
				queue.push({
					...item,
					status: 'failed',
					errorMessage: labels.restoreFailed,
				});
				continue;
			}

			if (file) taskFiles.set(item.id, file);

			if (item.status === 'uploading') {
				queue.push({ ...item, status: 'pending' });
			} else {
				queue.push(item);
			}
		}

		renderQueue();
		processUploadQueue();
	}

	selectBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		fileInput.click();
	});

	fileInput.addEventListener('change', () => {
		const files = fileInput.files ? Array.from(fileInput.files) : [];
		if (files.length > 0) handleFilesSelected(files);
	});

	dropzone.addEventListener('dragover', (e) => {
		e.preventDefault();
		dropzone.classList.add('border-blue-500', 'bg-blue-50');
	});

	dropzone.addEventListener('dragleave', () => {
		dropzone.classList.remove('border-blue-500', 'bg-blue-50');
	});

	dropzone.addEventListener('drop', (e) => {
		e.preventDefault();
		dropzone.classList.remove('border-blue-500', 'bg-blue-50');
		const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
		if (files.length > 0) handleFilesSelected(files);
	});

	dropzone.addEventListener('click', () => fileInput.click());

	submitBtn.addEventListener('click', () => void uploadFiles());

	submitBtn.disabled = true;

	const list = await fetchUploadedList();
	uploadedFiles.push(
		...list.map((f) => ({
			...f,
			originalName: normalizeFilename(f.originalName),
		})),
	);
	renderUploadedList();
	await restoreQueueFromStorage();
}
