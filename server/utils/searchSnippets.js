// 文件说明：从 contentIndex 提取 OCR 搜索命中上下文摘要，供列表与预览展示。
/**
 * 统计 query 在 contentIndex 中的非重叠命中次数。
 */
function countMatches(contentIndex, query) {
	const lowerContent = contentIndex.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const queryLen = lowerQuery.length;
	if (!queryLen) return { matchCount: 0, indices: [] };

	const indices = [];
	let searchFrom = 0;
	while (searchFrom < lowerContent.length) {
		const idx = lowerContent.indexOf(lowerQuery, searchFrom);
		if (idx === -1) break;
		indices.push(idx);
		searchFrom = idx + queryLen;
	}
	return { matchCount: indices.length, indices };
}

/**
 * 从 contentIndex 提取命中上下文（最多 maxSnippets 段，每段前后 contextLen 字符）。
 */
export function extractSearchSnippets(contentIndex, query, { maxSnippets = 3, contextLen = 80 } = {}) {
	if (!contentIndex || !query?.trim()) {
		return { snippets: [], matchCount: 0 };
	}

	const trimmedQuery = query.trim();
	const { matchCount, indices } = countMatches(contentIndex, trimmedQuery);
	const queryLen = trimmedQuery.length;

	const snippets = indices.slice(0, maxSnippets).map((idx) => {
		const match = contentIndex.slice(idx, idx + queryLen);
		let before = contentIndex.slice(Math.max(0, idx - contextLen), idx);
		let after = contentIndex.slice(idx + queryLen, idx + queryLen + contextLen);
		if (idx > contextLen) before = `…${before}`;
		if (idx + queryLen + contextLen < contentIndex.length) after = `${after}…`;
		return { before, match, after };
	});

	return { snippets, matchCount };
}
