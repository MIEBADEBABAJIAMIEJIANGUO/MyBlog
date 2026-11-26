// 文件说明：Agent 对话编排，组装 prompt、RAG、工具调用与流式输出。
import { agentMemoryMaxMessages } from '../../config/agent.js';
import {
	getAgentConfig,
	getChatSession,
	listChatMessages,
	appendChatMessage,
	listUserMemory,
	updateChatSession,
} from '../../repositories/agentRepository.js';
import { streamChatCompletion } from '../llm/deepseek.js';
import { retrieveKnowledgeChunks, formatKnowledgeContext } from '../rag/retriever.js';
import {
	WEB_SEARCH_TOOL,
	searchWeb,
	formatSearchResults,
	isTavilyConfigured,
} from '../tools/webSearch.js';
import { formatUserMemoryForPrompt, afterChatTurn } from '../memory/agentMemory.js';

/**
 * 向 SSE 响应写入事件。
 */
function sseWrite(res, event, data) {
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * 构建 system prompt（人设 + 记忆 + 会话摘要 + RAG）。
 */
function buildSystemPrompt(agent, session, memories, ragContext) {
	const parts = [
		`你的名字是「${agent.name}」。`,
		agent.persona,
		agent.speakingStyle ? `说话风格：${agent.speakingStyle}` : '',
		agent.background ? `背景设定：${agent.background}` : '',
		'你使用中文与主人交流，回答准确、有帮助。',
		formatUserMemoryForPrompt(memories),
		session?.summary ? `当前会话此前摘要：${session.summary}` : '',
		ragContext,
		isTavilyConfigured()
			? '当需要实时信息时可调用 web_search 工具。'
			: '当前未配置联网搜索，请勿编造实时新闻。',
	].filter(Boolean);
	return parts.join('\n\n');
}

/**
 * 将存储消息转为 DeepSeek API 消息格式。
 */
function toApiMessages(systemPrompt, history) {
	const msgs = [{ role: 'system', content: systemPrompt }];
	for (const m of history) {
		if (m.role === 'user' || m.role === 'assistant') {
			msgs.push({ role: m.role, content: m.content });
		}
	}
	return msgs;
}

/**
 * 执行一轮流式对话并写入 SSE。
 */
export async function runAgentChatStream({ sessionId, userMessage, res }) {
	const agent = await getAgentConfig();
	const session = await getChatSession(sessionId);
	if (!session) {
		sseWrite(res, 'error', { message: '会话不存在' });
		res.end();
		return;
	}

	await appendChatMessage({ sessionId, role: 'user', content: userMessage });

	const memories = await listUserMemory();
	const ragChunks = await retrieveKnowledgeChunks(agent.boundFilenames, userMessage);
	const ragContext = formatKnowledgeContext(ragChunks);

	const history = await listChatMessages(sessionId, agentMemoryMaxMessages + 1);
	const recent = history.slice(-agentMemoryMaxMessages);
	const systemPrompt = buildSystemPrompt(agent, session, memories, ragContext);
	let apiMessages = toApiMessages(systemPrompt, recent);

	const tools = isTavilyConfigured() ? [WEB_SEARCH_TOOL] : [];
	let fullContent = '';
	const citations = ragChunks.map((c) => ({
		filename: c.filename,
		originalName: c.originalName,
		text: c.text.slice(0, 200),
	}));

	if (citations.length) {
		sseWrite(res, 'citations', { citations });
	}

	const maxToolRounds = 2;
	for (let round = 0; round <= maxToolRounds; round++) {
		let roundContent = '';
		const toolCalls = await streamChatCompletion(apiMessages, {
			tools,
			onToken: (token) => {
				roundContent += token;
				sseWrite(res, 'token', { text: token });
			},
			signal: res.req?.signal,
		});
		fullContent += roundContent;

		if (!toolCalls.length || round === maxToolRounds) break;

		apiMessages = [
			...apiMessages,
			{
				role: 'assistant',
				content: fullContent || null,
				tool_calls: toolCalls.map((tc, i) => ({
					id: tc.id || `call_${i}`,
					type: 'function',
					function: { name: tc.name, arguments: tc.arguments },
				})),
			},
		];

		for (const [i, tc] of toolCalls.entries()) {
			if (tc.name !== 'web_search') continue;
			let args = {};
			try {
				args = JSON.parse(tc.arguments || '{}');
			} catch {
				args = {};
			}
			sseWrite(res, 'tool', { name: 'web_search', query: args.query ?? '' });
			const searchResult = await searchWeb(args.query ?? userMessage);
			const toolContent = formatSearchResults(searchResult);
			apiMessages.push({
				role: 'tool',
				tool_call_id: tc.id || `call_${i}`,
				content: toolContent,
			});
		}
	}

	if (fullContent.trim()) {
		await appendChatMessage({
			sessionId,
			role: 'assistant',
			content: fullContent.trim(),
			citations,
		});
		if (session.title === '新对话' && userMessage.length <= 40) {
			await updateChatSession(sessionId, { title: userMessage.slice(0, 40) });
		}
		void afterChatTurn(sessionId);
	}

	sseWrite(res, 'done', { sessionId });
	res.end();
}
