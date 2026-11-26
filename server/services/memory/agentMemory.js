// 文件说明：用户档案与会话摘要的长期记忆维护。
import { chatCompletion } from '../llm/deepseek.js';
import {
	listUserMemory,
	upsertUserMemoryEntries,
	updateChatSession,
	listChatMessages,
} from '../../repositories/agentRepository.js';
import { agentSummaryEveryN } from '../../config/agent.js';

/**
 * 将用户记忆条目格式化为 prompt 文本。
 */
export function formatUserMemoryForPrompt(memories) {
	if (!memories?.length) return '';
	const lines = memories.map((m) => `- ${m.key}：${m.value}`);
	return `关于主人的长期记忆（请自然运用，不要生硬复述）：\n${lines.join('\n')}`;
}

/**
 * 从最近对话中提取应写入 user_memory 的条目。
 */
export async function extractUserMemoryFromChat(recentMessages) {
	const transcript = recentMessages
		.map((m) => `${m.role === 'user' ? '主人' : '助手'}: ${m.content}`)
		.join('\n');
	const prompt = `根据以下对话，提取值得长期记住的关于「主人」的信息（称呼、偏好、习惯、重要事实）。\
以 JSON 数组输出，每项 { "type": "profile"|"fact", "key": "简短键", "value": "内容" }。\
若无新信息输出 []。只输出 JSON。`;

	try {
		const result = await chatCompletion([
			{ role: 'system', content: prompt },
			{ role: 'user', content: transcript },
		]);
		const text = result.choices?.[0]?.message?.content ?? '[]';
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return;
		const entries = JSON.parse(match[0]);
		if (Array.isArray(entries) && entries.length) {
			await upsertUserMemoryEntries(entries);
		}
	} catch (err) {
		console.warn('[agent-memory] extract user memory failed:', err.message);
	}
}

/**
 * 压缩会话历史为滚动摘要。
 */
export async function refreshSessionSummary(sessionId) {
	const messages = await listChatMessages(sessionId, 40);
	if (messages.length < 4) return;
	const transcript = messages
		.map((m) => `${m.role === 'user' ? '主人' : '助手'}: ${m.content}`)
		.join('\n');
	const prompt =
		'请用中文将以下对话压缩为 3～6 句话的摘要，保留关键事实与待办，不要列表符号堆砌。';

	try {
		const result = await chatCompletion([
			{ role: 'system', content: prompt },
			{ role: 'user', content: transcript },
		]);
		const summary = result.choices?.[0]?.message?.content?.trim();
		if (summary) await updateChatSession(sessionId, { summary });
	} catch (err) {
		console.warn('[agent-memory] session summary failed:', err.message);
	}
}

/**
 * 对话回合结束后异步更新记忆（档案 + 条件触发摘要）。
 */
export async function afterChatTurn(sessionId) {
	const memories = await listUserMemory();
	const messages = await listChatMessages(sessionId, 12);
	void extractUserMemoryFromChat(messages);
	const userCount = messages.filter((m) => m.role === 'user').length;
	if (userCount > 0 && userCount % agentSummaryEveryN === 0) {
		void refreshSessionSummary(sessionId);
	}
	return memories;
}
