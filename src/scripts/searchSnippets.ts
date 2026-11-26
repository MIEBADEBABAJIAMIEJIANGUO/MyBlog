// 文件说明：OCR 搜索命中摘要的 HTML 渲染工具，供文件列表展示使用。
import type { SearchSnippet } from './upload/types';

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

/**
 * 将单段命中摘要渲染为带 mark 高亮的安全 HTML。
 */
export function renderSnippetHtml(snippet: SearchSnippet): string {
	const before = escapeHtml(snippet.before);
	const match = escapeHtml(snippet.match);
	const after = escapeHtml(snippet.after);
	return `${before}<mark class="bg-yellow-200 text-gray-900 rounded px-0.5">${match}</mark>${after}`;
}

/**
 * 渲染多段摘要块，可选显示总命中次数。
 */
export function renderSnippetsBlock(
	snippets: SearchSnippet[],
	matchCount: number | undefined,
	labels: { searchMatchCount: string },
	maxVisible = 2,
): string {
	if (!snippets.length) return '';

	const visible = snippets.slice(0, maxVisible);
	const lines = visible
		.map(
			(s) =>
				`<p class="truncate text-gray-500 leading-relaxed cursor-pointer hover:text-gray-700" data-snippet-preview>${renderSnippetHtml(s)}</p>`,
		)
		.join('');

	const count = matchCount ?? snippets.length;
	const showCount = count > maxVisible || count > snippets.length;
	const countHtml = showCount
		? `<p class="text-gray-400 mt-0.5">${labels.searchMatchCount.replace('{count}', String(count))}</p>`
		: '';

	return `<div class="mt-1 space-y-0.5 max-w-md [&_mark]:bg-yellow-200 [&_mark]:text-gray-900" data-snippet-block>${lines}${countHtml}</div>`;
}
