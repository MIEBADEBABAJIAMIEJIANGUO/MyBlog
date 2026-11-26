// 文件说明：文件管理页客户端逻辑，表格列表、搜索筛选、分页、批量删除与文件操作。
import type { ApiResponse, FileListResponse, FileManagerLabels, UploadedFileInfo } from './upload/types';
import { networkFetch } from './networkFetch';
import { getApiBase, setApiBase } from './upload/types';
import { normalizeFilename } from './upload/filename';
import { openFilePreview } from './filePreview';
import { renderSnippetsBlock } from './searchSnippets';
import { requestConfirm } from './confirmDialog';
import { ensureIconfontLoaded, getFileExtension, getFileIconHtml } from './fileIcons';

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
 * 构建文件预览/下载完整 URL。
 */
function buildFileUrl(file: UploadedFileInfo): string {
	const path = file.url.startsWith('/') ? file.url : `/api/files/${encodeURIComponent(file.filename)}/preview`;
	return `${getApiBase()}${path}`;
}

/**
 * 格式化上传日期为 YYYY-MM-DD HH:mm:ss。
 */
function formatDateTime(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * HTML 转义，防止 XSS。
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** 预览图标 SVG */
const ICON_PREVIEW = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** 下载图标 SVG */
const ICON_DOWNLOAD = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/** 删除图标 SVG */
const ICON_DELETE = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

/**
 * 初始化文件管理界面。
 */
export async function initFileManager(root: HTMLElement): Promise<void> {
	ensureIconfontLoaded();

	if (root.dataset.apiBase) {
		setApiBase(root.dataset.apiBase);
	}

	const labelsJson = root.dataset.labels;
	if (!labelsJson) return;

	const labels = JSON.parse(labelsJson) as FileManagerLabels;

	const searchInput = root.querySelector<HTMLInputElement>('[data-search-input]');
	const searchModeSelect = root.querySelector<HTMLSelectElement>('[data-search-mode]');
	const filterSelect = root.querySelector<HTMLSelectElement>('[data-filter-select]');
	const tableBody = root.querySelector<HTMLElement>('[data-file-table-body]');
	const paginationEl = root.querySelector<HTMLElement>('[data-pagination]');
	const toastEl = root.querySelector<HTMLElement>('[data-toast]');
	const bulkToolbar = root.querySelector<HTMLElement>('[data-bulk-toolbar]');
	const bulkCountEl = root.querySelector<HTMLElement>('[data-bulk-count]');
	const bulkDeleteBtn = root.querySelector<HTMLButtonElement>('[data-bulk-delete]');
	const selectAllCheckbox = root.querySelector<HTMLInputElement>('[data-select-all]');

	if (
		!searchInput ||
		!searchModeSelect ||
		!filterSelect ||
		!tableBody ||
		!paginationEl ||
		!bulkToolbar ||
		!bulkCountEl ||
		!bulkDeleteBtn ||
		!selectAllCheckbox
	) {
		return;
	}

	let page = 1;
	const pageSize = 20;
	let q = '';
	let searchMode: 'name' | 'ocr' = 'name';
	let mimeCategory = '';
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const selectedFilenames = new Set<string>();
	let currentPageFilenames: string[] = [];
	let currentFiles: UploadedFileInfo[] = [];

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
	 * 清空选中状态并更新批量工具栏。
	 */
	function clearSelection(): void {
		selectedFilenames.clear();
		updateBulkToolbar();
		if (selectAllCheckbox) selectAllCheckbox.checked = false;
	}

	/**
	 * 更新批量操作栏显示。
	 */
	function updateBulkToolbar(): void {
		const count = selectedFilenames.size;
		if (count > 0) {
			bulkToolbar.classList.remove('hidden');
			bulkToolbar.classList.add('flex');
			bulkCountEl.textContent = fillTemplate(labels.bulkSelected, { count: String(count) });
		} else {
			bulkToolbar.classList.add('hidden');
			bulkToolbar.classList.remove('flex');
		}
		const allSelected =
			currentPageFilenames.length > 0 &&
			currentPageFilenames.every((f) => selectedFilenames.has(f));
		selectAllCheckbox.checked = allSelected;
		selectAllCheckbox.indeterminate =
			count > 0 && !allSelected && currentPageFilenames.some((f) => selectedFilenames.has(f));
	}

	/**
	 * 根据搜索模式更新输入框 placeholder。
	 */
	function updateSearchPlaceholder(): void {
		searchInput.placeholder =
			searchMode === 'ocr' ? labels.searchPlaceholderOcr : labels.search;
	}

	/**
	 * 从 API 拉取分页文件列表。
	 */
	async function fetchFiles(): Promise<FileListResponse | null> {
		const params = new URLSearchParams({
			page: String(page),
			pageSize: String(pageSize),
		});
		if (q) params.set('q', q);
		if (mimeCategory) params.set('mimeCategory', mimeCategory);
		if (searchMode === 'ocr') params.set('searchMode', 'ocr');

		try {
			// 列表本身已有骨架屏占位，不再触发全站进度条，避免搜索/翻页时反复闪烁
			const res = await networkFetch(`${getApiBase()}/api/files?${params.toString()}`, undefined, {
				silent: true,
			});
			const data = (await res.json()) as ApiResponse<FileListResponse>;
			if (data.success && data.data) return data.data;
		} catch {
			/* ignore */
		}
		return null;
	}

	/**
	 * 删除指定文件。
	 */
	async function deleteFile(filename: string): Promise<boolean> {
		try {
			const res = await networkFetch(`${getApiBase()}/api/upload/${encodeURIComponent(filename)}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as ApiResponse;
			return res.ok && data.success;
		} catch {
			return false;
		}
	}

	/**
	 * 打开文件预览，OCR 模式下传递高亮关键词与命中摘要。
	 */
	function openPreviewForFile(f: UploadedFileInfo): void {
		const fileUrl = buildFileUrl(f);
		const displayName = normalizeFilename(f.originalName);
		openFilePreview({
			url: fileUrl,
			filename: f.filename,
			originalName: displayName,
			mimeType: f.mimeType,
			highlightQuery: searchMode === 'ocr' && q ? q : undefined,
			searchSnippets: f.searchSnippets,
			matchCount: f.matchCount,
		});
	}

	/**
	 * 渲染单行表格 HTML。
	 */
	function renderRow(f: UploadedFileInfo): string {
		const fileUrl = buildFileUrl(f);
		const displayName = normalizeFilename(f.originalName);
		const name = escapeHtml(displayName);
		const extension = getFileExtension(displayName, f.mimeType);
		const checked = selectedFilenames.has(f.filename) ? 'checked' : '';
		const snippetsHtml =
			f.searchSnippets?.length && searchMode === 'ocr' && q
				? renderSnippetsBlock(f.searchSnippets, f.matchCount, {
						searchMatchCount: labels.searchMatchCount,
					})
				: '';
		return `
			<tr class="border-b border-gray-100 hover:bg-gray-50" data-filename="${escapeHtml(f.filename)}">
				<td class="px-3 py-3">
					<input type="checkbox" data-row-select="${escapeHtml(f.filename)}" class="rounded border-gray-300" ${checked} />
				</td>
				<td class="px-3 py-3">
					<!-- 原代码注释：max-w-md -->
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 min-w-0">
							${getFileIconHtml(extension)}
							<span class="truncate text-gray-900" title="${name}">${name}</span>
						</div>
						${snippetsHtml}
					</div>
				</td>
				<td class="px-3 py-3 text-gray-600 whitespace-nowrap">${labels.typeFile}</td>
				<!-- 原逻辑：getCategoryLabel(f.mimeType, labels) -->
				<td class="px-3 py-3 text-gray-600 whitespace-nowrap font-medium">${extension}</td>
				<td class="px-3 py-3 text-gray-400 whitespace-nowrap">${labels.expiryNone}</td>
				<td class="px-3 py-3 text-gray-600 whitespace-nowrap">${formatFileSize(f.size)}</td>
				<td class="px-3 py-3 text-gray-600 whitespace-nowrap">${formatDateTime(f.uploadedAt)}</td>
				<td class="px-3 py-3 whitespace-nowrap">
					<div class="flex items-center gap-1">
						<button type="button" data-preview="${escapeHtml(f.filename)}" data-file-url="${fileUrl}" data-mime-type="${escapeHtml(f.mimeType ?? '')}" data-original-name="${name}" class="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="${labels.preview}">${ICON_PREVIEW}</button>
						<a href="${fileUrl}" download="${name}" class="p-1.5 rounded hover:bg-gray-100 text-gray-600 inline-flex" title="${labels.download}">${ICON_DOWNLOAD}</a>
						<button type="button" data-delete-file="${escapeHtml(f.filename)}" class="p-1.5 rounded hover:bg-red-50 text-red-500" title="${labels.delete}">${ICON_DELETE}</button>
					</div>
				</td>
			</tr>`;
	}

	/**
	 * 绑定表格行内事件。
	 */
	function bindTableEvents(): void {
		tableBody.querySelectorAll('[data-row-select]').forEach((el) => {
			el.addEventListener('change', () => {
				const filename = (el as HTMLInputElement).dataset.rowSelect;
				if (!filename) return;
				if ((el as HTMLInputElement).checked) {
					selectedFilenames.add(filename);
				} else {
					selectedFilenames.delete(filename);
				}
				updateBulkToolbar();
			});
		});

		tableBody.querySelectorAll('[data-preview]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const el = btn as HTMLElement;
				const filename = el.dataset.preview;
				if (!filename) return;
				const file = currentFiles.find((item) => item.filename === filename);
				if (!file) return;
				openPreviewForFile(file);
			});
		});

		tableBody.querySelectorAll('[data-snippet-preview]').forEach((el) => {
			el.addEventListener('click', () => {
				const row = el.closest('tr');
				const filename = row?.getAttribute('data-filename');
				if (!filename) return;
				const file = currentFiles.find((item) => item.filename === filename);
				if (!file) return;
				openPreviewForFile(file);
			});
		});

		tableBody.querySelectorAll('[data-delete-file]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const filename = (btn as HTMLElement).dataset.deleteFile;
				if (!filename) return;
				void (async () => {
					// 原逻辑：confirm(labels.deleteConfirm)
					const ok = await requestConfirm(labels.deleteConfirm);
					if (!ok) return;
					const deleted = await deleteFile(filename);
					if (deleted) {
						selectedFilenames.delete(filename);
						await loadAndRender();
					}
				})();
			});
		});
	}

	/**
	 * 渲染文件表格与分页控件。
	 */
	function renderList(result: FileListResponse): void {
		currentPageFilenames = result.files.map((f) => f.filename);
		currentFiles = result.files;

		if (result.files.length === 0) {
			const ocrHint =
				searchMode === 'ocr' && q
					? `<p class="text-xs text-gray-400 mt-2">${labels.searchOcrPendingHint}</p>`
					: '';
			tableBody.innerHTML = `<tr><td colspan="8" class="px-3 py-8 text-center text-gray-500">${labels.empty}${ocrHint}</td></tr>`;
		} else {
			tableBody.innerHTML = result.files.map(renderRow).join('');
			bindTableEvents();
		}

		updateBulkToolbar();

		const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
		paginationEl.innerHTML = `
			<p class="text-sm text-gray-600">${fillTemplate(labels.pageInfo, {
				page: String(result.page),
				totalPages: String(totalPages),
				total: String(result.total),
			})}</p>
			<div class="flex gap-2">
				<button type="button" data-page-prev class="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40" ${result.page <= 1 ? 'disabled' : ''}>${labels.prev}</button>
				<button type="button" data-page-next class="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40" ${result.page >= totalPages ? 'disabled' : ''}>${labels.next}</button>
			</div>`;

		paginationEl.querySelector('[data-page-prev]')?.addEventListener('click', () => {
			if (page > 1) {
				page--;
				clearSelection();
				void loadAndRender();
			}
		});

		paginationEl.querySelector('[data-page-next]')?.addEventListener('click', () => {
			const totalPagesNext = Math.ceil(result.total / result.pageSize);
			if (page < totalPagesNext) {
				page++;
				clearSelection();
				void loadAndRender();
			}
		});
	}

	/**
	 * 生成骨架屏行，代替生硬的「…」纯文本占位。
	 */
	function renderSkeletonRows(): string {
		const widths = ['42%', '66%', '53%', '72%', '47%'];
		return widths
			.map(
				(width) =>
					`<tr aria-hidden="true"><td colspan="8" class="px-3 py-3"><div class="skeleton-line" style="width:${width}"></div></td></tr>`,
			)
			.join('');
	}

	/**
	 * 拉取数据并渲染界面。
	 */
	async function loadAndRender(): Promise<void> {
		tableBody.innerHTML = renderSkeletonRows();
		tableBody.setAttribute('aria-busy', 'true');
		paginationEl.innerHTML = '';
		const result = await fetchFiles();
		tableBody.removeAttribute('aria-busy');
		if (result) {
			renderList(result);
		} else {
			tableBody.innerHTML = `<tr><td colspan="8" class="px-3 py-8 text-center text-red-600">${labels.serverOffline}</td></tr>`;
			paginationEl.innerHTML = '';
		}
	}

	selectAllCheckbox.addEventListener('change', () => {
		if (selectAllCheckbox.checked) {
			for (const f of currentPageFilenames) {
				selectedFilenames.add(f);
			}
		} else {
			for (const f of currentPageFilenames) {
				selectedFilenames.delete(f);
			}
		}
		tableBody.querySelectorAll<HTMLInputElement>('[data-row-select]').forEach((cb) => {
			cb.checked = selectAllCheckbox.checked;
		});
		updateBulkToolbar();
	});

	bulkDeleteBtn.addEventListener('click', () => {
		const count = selectedFilenames.size;
		if (count === 0) return;

		void (async () => {
			// 原逻辑：confirm(fillTemplate(labels.bulkDeleteConfirm, { count: String(count) }))
			const ok = await requestConfirm(
				fillTemplate(labels.bulkDeleteConfirm, { count: String(count) }),
			);
			if (!ok) return;

			for (const filename of [...selectedFilenames]) {
				await deleteFile(filename);
			}
			clearSelection();
			await loadAndRender();
		})();
	});

	searchInput.addEventListener('input', () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			q = searchInput.value.trim();
			page = 1;
			clearSelection();
			void loadAndRender();
		}, 300);
	});

	searchModeSelect.addEventListener('change', () => {
		searchMode = searchModeSelect.value === 'ocr' ? 'ocr' : 'name';
		updateSearchPlaceholder();
		page = 1;
		clearSelection();
		void loadAndRender();
	});

	filterSelect.addEventListener('change', () => {
		mimeCategory = filterSelect.value;
		page = 1;
		clearSelection();
		void loadAndRender();
	});

	await loadAndRender();
	updateSearchPlaceholder();
}
