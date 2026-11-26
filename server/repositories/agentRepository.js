// 文件说明：Agent 配置、会话、消息与用户记忆的 MongoDB 仓储层。
import { getDb } from '../db/mongo.js';
import { AGENT_CONFIG_ID } from '../config/agent.js';
import {
	AGENT_CONFIG_COLLECTION,
	CHAT_SESSIONS_COLLECTION,
	CHAT_MESSAGES_COLLECTION,
	USER_MEMORY_COLLECTION,
} from '../models/agentRecord.js';

/** 默认 Agent 人设 */
const DEFAULT_AGENT_CONFIG = {
	_id: AGENT_CONFIG_ID,
	name: '小助手',
	persona: '你是主人的私人助理，熟悉主人上传的资料，回答准确、有温度。',
	speakingStyle: '温和、简洁，用中文交流',
	background: '',
	boundFilenames: [],
};

/**
 * 获取 agent_config 集合。
 */
function configCol() {
	return getDb().collection(AGENT_CONFIG_COLLECTION);
}

/**
 * 获取 chat_sessions 集合。
 */
function sessionsCol() {
	return getDb().collection(CHAT_SESSIONS_COLLECTION);
}

/**
 * 获取 chat_messages 集合。
 */
function messagesCol() {
	return getDb().collection(CHAT_MESSAGES_COLLECTION);
}

/**
 * 获取 user_memory 集合。
 */
function memoryCol() {
	return getDb().collection(USER_MEMORY_COLLECTION);
}

/**
 * 读取单 Agent 配置，不存在则写入默认值。
 */
export async function getAgentConfig() {
	let doc = await configCol().findOne({ _id: AGENT_CONFIG_ID });
	if (!doc) {
		const now = new Date();
		doc = { ...DEFAULT_AGENT_CONFIG, updatedAt: now, createdAt: now };
		await configCol().insertOne(doc);
	}
	return serializeAgentConfig(doc);
}

/**
 * 更新 Agent 人设与绑定文件列表。
 */
export async function updateAgentConfig(payload) {
	const now = new Date();
	const update = {
		name: String(payload.name ?? DEFAULT_AGENT_CONFIG.name).trim(),
		persona: String(payload.persona ?? '').trim(),
		speakingStyle: String(payload.speakingStyle ?? '').trim(),
		background: String(payload.background ?? '').trim(),
		boundFilenames: Array.isArray(payload.boundFilenames)
			? payload.boundFilenames.map(String)
			: [],
		updatedAt: now,
	};
	await configCol().updateOne(
		{ _id: AGENT_CONFIG_ID },
		{ $set: update, $setOnInsert: { _id: AGENT_CONFIG_ID, createdAt: now } },
		{ upsert: true },
	);
	return getAgentConfig();
}

/**
 * 列出所有会话，按更新时间倒序。
 */
export async function listChatSessions(limit = 50) {
	const docs = await sessionsCol().find({}).sort({ updatedAt: -1 }).limit(limit).toArray();
	return docs.map(serializeSession);
}

/**
 * 创建新会话。
 */
export async function createChatSession(title = '新对话') {
	const now = new Date();
	const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
	const doc = {
		_id: sessionId,
		sessionId,
		title: String(title).trim() || '新对话',
		summary: '',
		createdAt: now,
		updatedAt: now,
	};
	await sessionsCol().insertOne(doc);
	return serializeSession(doc);
}

/**
 * 按 ID 获取会话。
 */
export async function getChatSession(sessionId) {
	const doc = await sessionsCol().findOne({ _id: sessionId });
	return doc ? serializeSession(doc) : null;
}

/**
 * 更新会话标题或摘要。
 */
export async function updateChatSession(sessionId, patch) {
	const update = { updatedAt: new Date() };
	if (patch.title !== undefined) update.title = String(patch.title).trim();
	if (patch.summary !== undefined) update.summary = String(patch.summary).trim();
	await sessionsCol().updateOne({ _id: sessionId }, { $set: update });
	return getChatSession(sessionId);
}

/**
 * 删除会话及其消息。
 */
export async function deleteChatSession(sessionId) {
	await messagesCol().deleteMany({ sessionId });
	await sessionsCol().deleteOne({ _id: sessionId });
}

/**
 * 获取会话消息列表。
 */
export async function listChatMessages(sessionId, limit = 200) {
	const docs = await messagesCol()
		.find({ sessionId })
		.sort({ createdAt: 1 })
		.limit(limit)
		.toArray();
	return docs.map(serializeMessage);
}

/**
 * 追加一条聊天消息。
 */
export async function appendChatMessage({ sessionId, role, content, citations = [] }) {
	const now = new Date();
	const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
	const doc = {
		_id: messageId,
		messageId,
		sessionId,
		role,
		content,
		citations,
		createdAt: now,
	};
	await messagesCol().insertOne(doc);
	await sessionsCol().updateOne({ _id: sessionId }, { $set: { updatedAt: now } });
	return serializeMessage(doc);
}

/**
 * 统计会话内用户消息数量。
 */
export async function countUserMessages(sessionId) {
	return messagesCol().countDocuments({ sessionId, role: 'user' });
}

/**
 * 列出全部用户长期记忆。
 */
export async function listUserMemory() {
	const docs = await memoryCol().find({}).sort({ updatedAt: -1 }).toArray();
	return docs.map(serializeMemory);
}

/**
 * 批量 upsert 用户记忆条目。
 */
export async function upsertUserMemoryEntries(entries) {
	const now = new Date();
	for (const entry of entries) {
		if (!entry?.key?.trim() || !entry?.value?.trim()) continue;
		await memoryCol().updateOne(
			{ type: entry.type || 'fact', key: entry.key.trim() },
			{
				$set: {
					type: entry.type || 'fact',
					key: entry.key.trim(),
					value: entry.value.trim(),
					updatedAt: now,
				},
			},
			{ upsert: true },
		);
	}
}

/**
 * 序列化 Agent 配置。
 */
function serializeAgentConfig(doc) {
	return {
		name: doc.name,
		persona: doc.persona,
		speakingStyle: doc.speakingStyle,
		background: doc.background,
		boundFilenames: doc.boundFilenames ?? [],
		updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
	};
}

/**
 * 序列化会话。
 */
function serializeSession(doc) {
	return {
		sessionId: doc.sessionId ?? doc._id,
		title: doc.title,
		summary: doc.summary ?? '',
		createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
		updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
	};
}

/**
 * 序列化消息。
 */
function serializeMessage(doc) {
	return {
		messageId: doc.messageId ?? doc._id,
		sessionId: doc.sessionId,
		role: doc.role,
		content: doc.content,
		citations: doc.citations ?? [],
		createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
	};
}

/**
 * 序列化记忆条目。
 */
function serializeMemory(doc) {
	return {
		type: doc.type,
		key: doc.key,
		value: doc.value,
		updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
	};
}
