// 文件说明：DeepSeek Chat Completions 流式与非流式调用封装。
import { deepseekConfig } from '../../config/agent.js';

/**
 * 检查 DeepSeek API Key 是否已配置。
 */
export function isDeepseekConfigured() {
	return Boolean(deepseekConfig.apiKey);
}

/**
 * 调用 DeepSeek Chat Completions（非流式）。
 */
export async function chatCompletion(messages, { tools } = {}) {
	if (!isDeepseekConfigured()) {
		throw new Error('未配置 DEEPSEEK_API_KEY');
	}
	const body = {
		model: deepseekConfig.model,
		messages,
		stream: false,
	};
	if (tools?.length) body.tools = tools;

	const res = await fetch(`${deepseekConfig.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${deepseekConfig.apiKey}`,
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DeepSeek 请求失败: ${res.status} ${text}`);
	}
	return res.json();
}

/**
 * 流式调用 DeepSeek，解析 OpenAI SSE 格式并回调 token / 工具调用增量。
 */
export async function streamChatCompletion(messages, { tools, onToken, onToolCallDelta, signal }) {
	if (!isDeepseekConfigured()) {
		throw new Error('未配置 DEEPSEEK_API_KEY');
	}
	const body = {
		model: deepseekConfig.model,
		messages,
		stream: true,
	};
	if (tools?.length) body.tools = tools;

	const res = await fetch(`${deepseekConfig.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${deepseekConfig.apiKey}`,
		},
		body: JSON.stringify(body),
		signal,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DeepSeek 流式请求失败: ${res.status} ${text}`);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const toolCalls = {};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) continue;
			const data = trimmed.slice(5).trim();
			if (data === '[DONE]') continue;
			let json;
			try {
				json = JSON.parse(data);
			} catch {
				continue;
			}
			const delta = json.choices?.[0]?.delta;
			if (!delta) continue;
			if (delta.content) onToken?.(delta.content);
			if (delta.tool_calls) {
				for (const tc of delta.tool_calls) {
					const idx = tc.index ?? 0;
					if (!toolCalls[idx]) {
						toolCalls[idx] = { id: tc.id ?? '', name: '', arguments: '' };
					}
					if (tc.id) toolCalls[idx].id = tc.id;
					if (tc.function?.name) toolCalls[idx].name += tc.function.name;
					if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
					onToolCallDelta?.(idx, toolCalls[idx]);
				}
			}
		}
	}

	return Object.values(toolCalls).filter((tc) => tc.name);
}
