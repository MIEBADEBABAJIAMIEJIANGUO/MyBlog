// 文件说明：Agent 相关 MongoDB 集合名与索引定义。
export const AGENT_CONFIG_COLLECTION = 'agent_config';
export const CHAT_SESSIONS_COLLECTION = 'chat_sessions';
export const CHAT_MESSAGES_COLLECTION = 'chat_messages';
export const USER_MEMORY_COLLECTION = 'user_memory';

/**
 * 确保 Agent 相关集合索引存在。
 */
export async function ensureAgentIndexes(db) {
	await db.collection(AGENT_CONFIG_COLLECTION).createIndex({ updatedAt: -1 });
	await db.collection(CHAT_SESSIONS_COLLECTION).createIndex({ updatedAt: -1 });
	await db.collection(CHAT_MESSAGES_COLLECTION).createIndex({ sessionId: 1, createdAt: 1 });
	await db.collection(USER_MEMORY_COLLECTION).createIndex({ type: 1, key: 1 }, { unique: true });
}
