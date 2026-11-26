// 文件说明：预览弹窗内关键词高亮与滚动定位工具。
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

const MARK_CLASS = 'bg-yellow-200 text-gray-900 rounded px-0.5';

/**
 * 将纯文本转为带 mark 高亮的安全 HTML 片段。
 */
export function highlightTextContent(text: string, query: string): string {
	const trimmed = query.trim();
	if (!trimmed) return escapeHtml(text);

	const lowerText = text.toLowerCase();
	const lowerQuery = trimmed.toLowerCase();
	const queryLen = trimmed.length;

	let result = '';
	let lastIndex = 0;
	let idx = lowerText.indexOf(lowerQuery);

	while (idx !== -1) {
		result += escapeHtml(text.slice(lastIndex, idx));
		result += `<mark class="${MARK_CLASS}">${escapeHtml(text.slice(idx, idx + queryLen))}</mark>`;
		lastIndex = idx + queryLen;
		idx = lowerText.indexOf(lowerQuery, lastIndex);
	}

	result += escapeHtml(text.slice(lastIndex));
	return result;
}

/**
 * 对已渲染 DOM 用 TreeWalker 包裹文本节点中的匹配项。
 */
export function highlightInElement(root: HTMLElement, query: string): number {
	const trimmed = query.trim();
	if (!trimmed) return 0;

	const lowerQuery = trimmed.toLowerCase();
	const queryLen = trimmed.length;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let node: Node | null;
	while ((node = walker.nextNode())) {
		const parent = node.parentElement;
		if (parent?.tagName === 'MARK' || parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE') {
			continue;
		}
		textNodes.push(node as Text);
	}

	let count = 0;
	for (const textNode of textNodes) {
		const text = textNode.data;
		const lowerText = text.toLowerCase();
		let idx = lowerText.indexOf(lowerQuery);
		if (idx === -1) continue;

		const frag = document.createDocumentFragment();
		let lastIndex = 0;

		while (idx !== -1) {
			if (idx > lastIndex) {
				frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
			}
			const mark = document.createElement('mark');
			mark.className = MARK_CLASS;
			mark.textContent = text.slice(idx, idx + queryLen);
			frag.appendChild(mark);
			count++;
			lastIndex = idx + queryLen;
			idx = lowerText.indexOf(lowerQuery, lastIndex);
		}

		if (lastIndex < text.length) {
			frag.appendChild(document.createTextNode(text.slice(lastIndex)));
		}
		textNode.parentNode?.replaceChild(frag, textNode);
	}

	return count;
}

/**
 * 滚动到容器内第一处 mark 高亮。
 */
export function scrollToFirstMark(root: HTMLElement): void {
	root.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * 判断预览类型是否支持 DOM 内高亮。
 */
export function supportsDomHighlight(kind: string): boolean {
	return kind === 'text' || kind === 'doc' || kind === 'docx' || kind === 'xlsx';
}
