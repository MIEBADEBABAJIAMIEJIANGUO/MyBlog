// 文件说明：基于 Radix Dialog 的文件预览弹窗，按 MIME 类型渲染图片/PDF/文本/Word/音视频等预览内容。
import * as Dialog from '@radix-ui/react-dialog';
import mammoth from 'mammoth';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	FILE_PREVIEW_EVENT,
	getPreviewKind,
	type FilePreviewLabels,
	type PreviewFilePayload,
	type PreviewKind,
} from '../scripts/filePreview';
import { highlightInElement, scrollToFirstMark, supportsDomHighlight } from '../scripts/highlightPreview';
import { renderSnippetHtml } from '../scripts/searchSnippets';
import type { SearchSnippet } from '../scripts/upload/types';
import { getApiBase } from '../scripts/upload/types';
import { networkFetch } from '../scripts/networkFetch';
import LottieLoading from './LottieLoading';
import {
	arrayBufferToSheetPreviews,
	type XlsxSheetPreview,
} from '../scripts/xlsxPreview';

interface Props {
	labels: FilePreviewLabels;
}

const XLSX_TABLE_CLASS =
	'text-xs text-gray-800 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:font-medium';

/**
 * 多工作表 Excel 预览：表格区域 + 底部 Tab 切换。
 */
function XlsxPreview({
	sheets,
	activeIndex,
	onActiveIndexChange,
	contentRef,
}: {
	sheets: XlsxSheetPreview[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	contentRef?: React.RefObject<HTMLDivElement | null>;
}) {
	const activeSheet = sheets[activeIndex] ?? sheets[0];

	return (
		<div className="flex flex-col max-h-[70vh] rounded-lg border border-gray-200 bg-white overflow-hidden">
			<div ref={contentRef} className={`flex-1 min-h-0 overflow-auto p-4 ${XLSX_TABLE_CLASS}`}>
				<div dangerouslySetInnerHTML={{ __html: activeSheet?.html ?? '' }} />
			</div>
			<div className="shrink-0 border-t border-gray-200 bg-gray-50 overflow-x-auto">
				<div className="flex flex-nowrap min-w-0">
					{sheets.map((sheet, index) => {
						const isActive = index === activeIndex;
						return (
							<button
								key={`${sheet.name}-${index}`}
								type="button"
								title={sheet.name}
								onClick={() => onActiveIndexChange(index)}
								className={`shrink-0 px-3 py-2 text-xs whitespace-nowrap truncate max-w-[8rem] border-b-2 transition-colors ${
									isActive
										? 'border-indigo-600 text-indigo-600 font-medium bg-white'
										: 'border-transparent text-gray-600 hover:bg-gray-100'
								}`}
							>
								{sheet.name}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/**
 * PDF/图片等无法 DOM 高亮时，在预览顶部展示 OCR 命中摘要条。
 */
function SearchSnippetBar({
	snippets,
	matchCount,
	highlightQuery,
	labels,
}: {
	snippets: SearchSnippet[];
	matchCount?: number;
	highlightQuery: string;
	labels: FilePreviewLabels;
}) {
	const [collapsed, setCollapsed] = useState(false);
	const total = matchCount ?? snippets.length;

	return (
		<div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 text-xs">
			<button
				type="button"
				onClick={() => setCollapsed((v) => !v)}
				className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-amber-900 hover:bg-amber-100/60 rounded-lg"
			>
				<span>
					{labels.searchHitSummary}: &quot;{highlightQuery}&quot;
				</span>
				<span className="text-amber-700 shrink-0">{collapsed ? '▸' : '▾'}</span>
			</button>
			{!collapsed && (
				<div className="px-3 pb-3 space-y-1 [&_mark]:bg-yellow-200 [&_mark]:text-gray-900">
					{snippets.map((snippet, index) => (
						<p
							key={`${snippet.match}-${index}`}
							className="text-gray-600 truncate leading-relaxed"
							dangerouslySetInnerHTML={{ __html: renderSnippetHtml(snippet) }}
						/>
					))}
					{total > snippets.length && (
						<p className="text-gray-400 pt-0.5">
							{labels.searchMatchCount.replace('{count}', String(total))}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * 根据预览模式渲染对应的内容区域。
 */
function PreviewBody({
	kind,
	url,
	filename,
	originalName,
	labels,
	highlightQuery,
	searchSnippets,
	matchCount,
}: {
	kind: PreviewKind;
	url: string;
	filename: string;
	originalName: string;
	labels: FilePreviewLabels;
	highlightQuery?: string;
	searchSnippets?: SearchSnippet[];
	matchCount?: number;
}) {
	// const [loading, setLoading] = useState(kind === 'text' || kind === 'docx' || kind === 'xlsx');
	const [loading, setLoading] = useState(
		kind === 'text' || kind === 'doc' || kind === 'docx' || kind === 'xlsx',
	);
	const [error, setError] = useState('');
	const [textContent, setTextContent] = useState('');
	// const [docxHtml, setDocxHtml] = useState('');
	const [wordHtml, setWordHtml] = useState('');
	// const [xlsxHtml, setXlsxHtml] = useState('');
	const [xlsxSheets, setXlsxSheets] = useState<XlsxSheetPreview[]>([]);
	const [activeSheetIndex, setActiveSheetIndex] = useState(0);
	const mediaRef = useRef<HTMLMediaElement | null>(null);
	const preRef = useRef<HTMLPreElement>(null);
	const wordRef = useRef<HTMLDivElement>(null);
	const xlsxContentRef = useRef<HTMLDivElement>(null);

	const showSnippetBar =
		Boolean(highlightQuery?.trim()) &&
		!supportsDomHighlight(kind) &&
		Boolean(searchSnippets?.length);

	const snippetBar = showSnippetBar ? (
		<SearchSnippetBar
			snippets={searchSnippets!}
			matchCount={matchCount}
			highlightQuery={highlightQuery!.trim()}
			labels={labels}
		/>
	) : null;

	useEffect(() => {
		return () => {
			if (mediaRef.current) {
				mediaRef.current.pause();
				mediaRef.current.removeAttribute('src');
				mediaRef.current.load();
			}
		};
	}, [url, kind]);

	useEffect(() => {
		// if (kind !== 'text' && kind !== 'docx' && kind !== 'xlsx') return;
		if (kind !== 'text' && kind !== 'doc' && kind !== 'docx' && kind !== 'xlsx') return;

		let cancelled = false;
		setLoading(true);
		setError('');
		setTextContent('');
		setWordHtml('');
		setXlsxSheets([]);
		setActiveSheetIndex(0);

		void (async () => {
			try {
				if (kind === 'doc') {
					const previewUrl = `${getApiBase()}/api/files/${encodeURIComponent(filename)}/preview-doc`;
					const res = await networkFetch(previewUrl, undefined, { silent: true });
					if (!res.ok) throw new Error('fetch failed');
					const json = (await res.json()) as { success?: boolean; data?: { html?: string } };
					if (!json.success || !json.data?.html) throw new Error('invalid response');
					if (!cancelled) setWordHtml(json.data.html);
				} else {
					const res = await networkFetch(url, undefined, { silent: true });
					if (!res.ok) throw new Error('fetch failed');

					if (kind === 'text') {
						const text = await res.text();
						if (!cancelled) setTextContent(text);
					} else if (kind === 'docx') {
						const buffer = await res.arrayBuffer();
						const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
						if (!cancelled) setWordHtml(result.value);
					} else if (kind === 'xlsx') {
						const buffer = await res.arrayBuffer();
						// const workbook = XLSX.read(buffer, { type: 'array' });
						// const firstSheetName = workbook.SheetNames[0];
						// if (!firstSheetName) throw new Error('empty workbook');
						// const worksheet = workbook.Sheets[firstSheetName];
						// const html = XLSX.utils.sheet_to_html(worksheet);
						// if (!cancelled) setXlsxHtml(html);
						const sheets = arrayBufferToSheetPreviews(buffer);
						if (!cancelled) {
							setXlsxSheets(sheets);
							setActiveSheetIndex(0);
						}
					}
				}
			} catch {
				if (!cancelled) setError(labels.loadError);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [kind, url, filename, labels.loadError]);

	useEffect(() => {
		if (loading || kind !== 'xlsx' || !highlightQuery?.trim() || xlsxSheets.length === 0) return;
		const qLower = highlightQuery.trim().toLowerCase();
		const sheetIdx = xlsxSheets.findIndex((sheet) => sheet.html.toLowerCase().includes(qLower));
		if (sheetIdx >= 0) setActiveSheetIndex(sheetIdx);
	}, [loading, kind, highlightQuery, xlsxSheets]);

	useEffect(() => {
		if (loading || !highlightQuery?.trim()) return;

		const runHighlight = () => {
			if (kind === 'text' && preRef.current) {
				highlightInElement(preRef.current, highlightQuery);
				scrollToFirstMark(preRef.current);
			} else if ((kind === 'doc' || kind === 'docx') && wordRef.current) {
				highlightInElement(wordRef.current, highlightQuery);
				scrollToFirstMark(wordRef.current);
			} else if (kind === 'xlsx' && xlsxContentRef.current) {
				highlightInElement(xlsxContentRef.current, highlightQuery);
				scrollToFirstMark(xlsxContentRef.current);
			}
		};

		const frameId = requestAnimationFrame(runHighlight);
		return () => cancelAnimationFrame(frameId);
	}, [loading, highlightQuery, kind, textContent, wordHtml, xlsxSheets, activeSheetIndex]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[240px]">
				<LottieLoading size="md" label={labels.loading} />
			</div>
		);
	}

	if (error) {
		return (
			<>
				{snippetBar}
				<UnsupportedFallback url={url} originalName={originalName} labels={labels} message={error} />
			</>
		);
	}

	if (kind === 'image' || kind === 'svg') {
		return (
			<>
				{snippetBar}
				<div className="flex items-center justify-center min-h-[240px] bg-gray-50 rounded-lg overflow-hidden">
					<img
						src={url}
						alt={originalName}
						className="max-h-[70vh] max-w-full object-contain"
					/>
				</div>
			</>
		);
	}

	if (kind === 'pdf') {
		return (
			<>
				{snippetBar}
				<iframe
					src={url}
					title={originalName}
					className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
				/>
			</>
		);
	}

	if (kind === 'text') {
		return (
			<>
				{snippetBar}
				<pre
					ref={preRef}
					className="max-h-[70vh] overflow-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-800 whitespace-pre-wrap break-words font-mono [&_mark]:bg-yellow-200 [&_mark]:text-gray-900"
				>
					{textContent}
				</pre>
			</>
		);
	}

	if (kind === 'doc' || kind === 'docx') {
		return (
			<>
				{snippetBar}
				<div
					ref={wordRef}
					className="max-h-[70vh] overflow-auto rounded-lg bg-white p-4 text-xs text-gray-800 leading-relaxed [&_p]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_mark]:bg-yellow-200 [&_mark]:text-gray-900"
					dangerouslySetInnerHTML={{ __html: wordHtml }}
				/>
			</>
		);
	}

	if (kind === 'xlsx') {
		return (
			<>
				{snippetBar}
				<XlsxPreview
					sheets={xlsxSheets}
					activeIndex={activeSheetIndex}
					onActiveIndexChange={setActiveSheetIndex}
					contentRef={xlsxContentRef}
				/>
			</>
		);
	}

	if (kind === 'video') {
		return (
			<>
				{snippetBar}
				<div className="flex items-center justify-center min-h-[240px] bg-black rounded-lg overflow-hidden">
					<video ref={mediaRef} src={url} controls className="w-full max-h-[70vh]">
						<track kind="captions" />
					</video>
				</div>
			</>
		);
	}

	if (kind === 'audio') {
		return (
			<>
				{snippetBar}
				<div className="flex items-center justify-center min-h-[120px] px-4 py-8 bg-gray-50 rounded-lg">
					<audio ref={mediaRef} src={url} controls className="w-full" />
				</div>
			</>
		);
	}

	return (
		<>
			{snippetBar}
			<UnsupportedFallback url={url} originalName={originalName} labels={labels} />
		</>
	);
}

/* 原代码注释：以下为高亮改造前的独立 return 分支
	if (error) {
		return <UnsupportedFallback url={url} originalName={originalName} labels={labels} message={error} />;
	}

	if (kind === 'image' || kind === 'svg') {
		return (
			<div className="flex items-center justify-center min-h-[240px] bg-gray-50 rounded-lg overflow-hidden">
				<img
					src={url}
					alt={originalName}
					className="max-h-[70vh] max-w-full object-contain"
				/>
			</div>
		);
	}

	if (kind === 'pdf') {
		return (
			<iframe
				src={url}
				title={originalName}
				className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
			/>
		);
	}

	if (kind === 'text') {
		return (
			<pre className="max-h-[70vh] overflow-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-800 whitespace-pre-wrap break-words font-mono">
				{textContent}
			</pre>
		);
	}

	if (kind === 'doc' || kind === 'docx') {
		return (
			<div
				className="max-h-[70vh] overflow-auto rounded-lg bg-white p-4 text-xs text-gray-800 leading-relaxed [&_p]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
				dangerouslySetInnerHTML={{ __html: wordHtml }}
			/>
		);
	}

	if (kind === 'xlsx') {
		return (
			<XlsxPreview
				sheets={xlsxSheets}
				activeIndex={activeSheetIndex}
				onActiveIndexChange={setActiveSheetIndex}
			/>
		);
	}

	if (kind === 'video') {
		return (
			<div className="flex items-center justify-center min-h-[240px] bg-black rounded-lg overflow-hidden">
				<video ref={mediaRef} src={url} controls className="w-full max-h-[70vh]">
					<track kind="captions" />
				</video>
			</div>
		);
	}

	if (kind === 'audio') {
		return (
			<div className="flex items-center justify-center min-h-[120px] px-4 py-8 bg-gray-50 rounded-lg">
				<audio ref={mediaRef} src={url} controls className="w-full" />
			</div>
		);
	}

	return <UnsupportedFallback url={url} originalName={originalName} labels={labels} />;
*/

/**
 * 不支持在线预览时的降级 UI，提供下载与新窗口打开。
 */
function UnsupportedFallback({
	url,
	originalName,
	labels,
	message,
}: {
	url: string;
	originalName: string;
	labels: FilePreviewLabels;
	message?: string;
}) {
	/**
	 * 触发文件下载，避免使用全局 a 标签样式导致按钮文字不可读。
	 */
	const handleDownload = () => {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = originalName;
		anchor.rel = 'noopener noreferrer';
		anchor.click();
	};

	/**
	 * 在新窗口打开文件链接。
	 */
	const handleOpenNew = () => {
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	return (
		<div className="flex flex-col items-center justify-center gap-4 min-h-[240px] text-center px-4 text-sm">
			<p className="text-gray-600">{message ?? labels.unsupported}</p>
			<div className="flex flex-wrap items-center justify-center gap-3">
				{/* 原代码注释：
				<a
					href={url}
					download={originalName}
					className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
				>
					{labels.download}
				</a>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
				>
					{labels.openNew}
				</a>
				*/}
				<button
					type="button"
					onClick={handleDownload}
					className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
				>
					{labels.download}
				</button>
				<button
					type="button"
					onClick={handleOpenNew}
					className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50"
				>
					{labels.openNew}
				</button>
			</div>
		</div>
	);
}

/**
 * 挂载于文件管理页，监听预览事件并展示 Radix 弹窗。
 */
export default function FilePreviewModal({ labels }: Props) {
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<PreviewFilePayload | null>(null);

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next);
		if (!next) setFile(null);
	}, []);

	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<PreviewFilePayload>).detail;
			if (!detail?.url) return;
			setFile(detail);
			setOpen(true);
		};

		window.addEventListener(FILE_PREVIEW_EVENT, handler);
		return () => window.removeEventListener(FILE_PREVIEW_EVENT, handler);
	}, []);

	const kind = file ? getPreviewKind(file.mimeType) : 'unsupported';

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[min(960px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl flex flex-col outline-none text-sm">
					<div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
						<Dialog.Title className="text-sm font-medium text-gray-900 truncate pr-2">
							{file?.originalName ?? ''}
						</Dialog.Title>
						<Dialog.Close
							className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
							aria-label={labels.close}
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</Dialog.Close>
					</div>
					<div className="p-4 overflow-auto min-h-0">
						{file && (
							<PreviewBody
								key={`${file.filename}-${file.url}-${file.highlightQuery ?? ''}`}
								kind={kind}
								url={file.url}
								filename={file.filename}
								originalName={file.originalName}
								labels={labels}
								highlightQuery={file.highlightQuery}
								searchSnippets={file.searchSnippets}
								matchCount={file.matchCount}
							/>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
