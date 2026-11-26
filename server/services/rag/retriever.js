// 文件说明：从 Agent 绑定的已索引文件中检索 RAG 上下文片段。
import { getDb } from '../../db/mongo.js';
import { FILES_COLLECTION } from '../../models/fileRecord.js';
import { extractSearchSnippets } from '../../utils/searchSnippets.js';
import { agentRagMaxChunks } from '../../config/agent.js';

/**
 * 将多段 snippet 拼成可读文本。
 */
function snippetToText(snippet) {
	return `${snippet.before}${snippet.match}${snippet.after}`;
}

/**
 * 从绑定文件的 contentIndex 中检索与用户问题相关的片段。
 */
export async function retrieveKnowledgeChunks(boundFilenames, query, maxChunks = agentRagMaxChunks) {
	const trimmed = query?.trim();
	if (!trimmed || !boundFilenames?.length) return [];

	const docs = await getDb()
		.collection(FILES_COLLECTION)
		.find({
			filename: { $in: boundFilenames },
			indexStatus: 'done',
			contentIndex: { $exists: true, $ne: '' },
		})
		.project({ filename: 1, originalName: 1, contentIndex: 1 })
		.toArray();

	const chunks = [];
	for (const doc of docs) {
		const { snippets } = extractSearchSnippets(doc.contentIndex, trimmed, {
			maxSnippets: 2,
			contextLen: 120,
		});
		for (const snippet of snippets) {
			chunks.push({
				filename: doc.filename,
				originalName: doc.originalName,
				text: snippetToText(snippet),
			});
		}
	}

	if (chunks.length >= maxChunks) return chunks.slice(0, maxChunks);

	// 关键词过短或未命中时，补充绑定文件的开头摘要
	if (chunks.length === 0 && trimmed.length >= 2) {
		for (const doc of docs.slice(0, maxChunks)) {
			const preview = (doc.contentIndex ?? '').slice(0, 400).trim();
			if (!preview) continue;
			chunks.push({
				filename: doc.filename,
				originalName: doc.originalName,
				text: preview.length < (doc.contentIndex?.length ?? 0) ? `${preview}…` : preview,
			});
		}
	}

	return chunks.slice(0, maxChunks);
}

/**
 * 将检索片段格式化为 system 注入文本。
 */
export function formatKnowledgeContext(chunks) {
	if (!chunks.length) return '';
	const lines = chunks.map(
		(c, i) => `[${i + 1}] 文件「${c.originalName}」(${c.filename}):\n${c.text}`,
	);
	return `以下是与用户问题相关的知识库片段，请优先依据它们回答，并在必要时说明来源文件名：\n\n${lines.join('\n\n')}`;
}
