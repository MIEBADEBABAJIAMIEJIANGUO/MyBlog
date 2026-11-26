// 文件说明：Tavily 联网搜索工具封装。
import { tavilyConfig } from '../../config/agent.js';

/**
 * 检查 Tavily API Key 是否已配置。
 */
export function isTavilyConfigured() {
	return Boolean(tavilyConfig.apiKey);
}

/**
 * 调用 Tavily Search API 获取实时网页摘要。
 */
export async function searchWeb(query, maxResults = 5) {
	if (!isTavilyConfigured()) {
		return { query, results: [], error: '未配置 TAVILY_API_KEY' };
	}
	const res = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			api_key: tavilyConfig.apiKey,
			query,
			max_results: maxResults,
			include_answer: true,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		return { query, results: [], error: `Tavily 失败: ${res.status} ${text}` };
	}
	const data = await res.json();
	return {
		query,
		answer: data.answer ?? '',
		results: (data.results ?? []).map((r) => ({
			title: r.title,
			url: r.url,
			content: r.content,
		})),
	};
}

/**
 * 将 Tavily 结果格式化为模型可读文本。
 */
export function formatSearchResults(searchPayload) {
	if (searchPayload.error) return `联网搜索不可用：${searchPayload.error}`;
	const parts = [];
	if (searchPayload.answer) parts.push(`摘要：${searchPayload.answer}`);
	for (const [i, r] of (searchPayload.results ?? []).entries()) {
		parts.push(`[${i + 1}] ${r.title}\n${r.url}\n${r.content ?? ''}`);
	}
	return parts.join('\n\n') || '未找到相关结果';
}

/** DeepSeek 工具定义：联网搜索 */
export const WEB_SEARCH_TOOL = {
	type: 'function',
	function: {
		name: 'web_search',
		description: '搜索互联网以获取实时信息、新闻或最新资料。当用户问题涉及当前事件、实时数据或知识库中没有的内容时使用。',
		parameters: {
			type: 'object',
			properties: {
				query: { type: 'string', description: '搜索关键词' },
			},
			required: ['query'],
		},
	},
};
