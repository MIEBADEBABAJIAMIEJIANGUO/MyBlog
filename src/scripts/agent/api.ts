// 文件说明：Agent 模块 API 客户端封装。
import type { AgentConfig, ChatMessage, ChatSession } from './labels';
import { networkFetch } from '../networkFetch';
import { getApiBase } from '../upload/types';

interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
}

/**
 * 解析统一 API 响应。
 */
async function parseJson<T>(res: Response): Promise<T> {
	const data = (await res.json()) as ApiResponse<T>;
	if (!res.ok || !data.success) {
		throw new Error(data.message ?? `请求失败 ${res.status}`);
	}
	return data.data as T;
}

/**
 * 获取 Agent 配置。
 */
export async function fetchAgentConfig(): Promise<AgentConfig> {
	const res = await networkFetch(`${getApiBase()}/api/agent/config`, undefined, { silent: true });
	return parseJson<AgentConfig>(res);
}

/**
 * 保存 Agent 配置。
 */
export async function saveAgentConfig(payload: Partial<AgentConfig>): Promise<AgentConfig> {
	const res = await networkFetch(`${getApiBase()}/api/agent/config`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return parseJson<AgentConfig>(res);
}

/**
 * 列出会话。
 */
export async function fetchSessions(): Promise<ChatSession[]> {
	const res = await networkFetch(`${getApiBase()}/api/agent/sessions`, undefined, { silent: true });
	const data = await parseJson<{ sessions: ChatSession[] }>(res);
	return data.sessions;
}

/**
 * 创建会话。
 */
export async function createSession(title?: string): Promise<ChatSession> {
	const res = await networkFetch(`${getApiBase()}/api/agent/sessions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title }),
	});
	return parseJson<ChatSession>(res);
}

/**
 * 删除会话。
 */
export async function deleteSession(sessionId: string): Promise<void> {
	const res = await networkFetch(
		`${getApiBase()}/api/agent/sessions/${encodeURIComponent(sessionId)}`,
		{ method: 'DELETE' },
	);
	await parseJson(res);
}

/**
 * 获取会话消息。
 */
export async function fetchMessages(
	sessionId: string,
): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
	const res = await networkFetch(
		`${getApiBase()}/api/agent/sessions/${encodeURIComponent(sessionId)}/messages`,
		undefined,
		{ silent: true },
	);
	return parseJson<{ session: ChatSession; messages: ChatMessage[] }>(res);
}

/**
 * SSE 流式发送消息并消费 token 事件。
 */
export async function streamChat(
	sessionId: string,
	message: string,
	handlers: {
		onToken: (text: string) => void;
		onCitations?: (citations: unknown[]) => void;
		onTool?: (payload: { name: string; query: string }) => void;
		onError?: (msg: string) => void;
	},
): Promise<void> {
	const res = await networkFetch(
		`${getApiBase()}/api/agent/chat`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId, message }),
		},
		{ silent: true },
	);
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as ApiResponse;
		throw new Error(err.message ?? `聊天失败 ${res.status}`);
	}
	if (!res.body) throw new Error('无响应流');

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const blocks = buffer.split('\n\n');
		buffer = blocks.pop() ?? '';

		for (const block of blocks) {
			const lines = block.split('\n');
			let event = 'message';
			let data = '';
			for (const line of lines) {
				if (line.startsWith('event:')) event = line.slice(6).trim();
				if (line.startsWith('data:')) data = line.slice(5).trim();
			}
			if (!data) continue;
			try {
				const json = JSON.parse(data) as Record<string, unknown>;
				if (event === 'token' && typeof json.text === 'string') handlers.onToken(json.text);
				if (event === 'citations' && Array.isArray(json.citations)) {
					handlers.onCitations?.(json.citations);
				}
				if (event === 'tool') handlers.onTool?.(json as { name: string; query: string });
				if (event === 'error' && typeof json.message === 'string') handlers.onError?.(json.message);
			} catch {
				/* ignore parse errors */
			}
		}
	}
}

/**
 * 拉取可绑定的文件列表（分页取前 200 条）。
 */
export async function fetchFilesForBinding(): Promise<
	Array<{ filename: string; originalName: string; indexStatus?: string }>
> {
	const res = await networkFetch(`${getApiBase()}/api/files?page=1&pageSize=200`, undefined, {
		silent: true,
	});
	const data = (await res.json()) as ApiResponse<{
		files: Array<{ filename: string; originalName: string; indexStatus?: string }>;
	}>;
	if (!data.success || !data.data) return [];
	return data.data.files;
}
