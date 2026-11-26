// 文件说明：已上传文件清单读写工具，持久化 originalName 等元数据供 list 接口使用。
import fs from 'fs';
import path from 'path';
import { normalizeFilename } from './filename.js';

/**
 * 获取 manifest 文件路径。
 */
function getManifestPath(uploadsDir) {
	return path.join(uploadsDir, '.manifest.json');
}

/**
 * 读取磁盘上的原始 manifest 数据（不做文件名解码）。
 */
function readRawManifest(uploadsDir) {
	const manifestPath = getManifestPath(uploadsDir);
	if (!fs.existsSync(manifestPath)) {
		return [];
	}
	try {
		return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
	} catch {
		return [];
	}
}

/**
 * 对单条 manifest 记录的 originalName 做 UTF-8 解码。
 */
function normalizeEntry(entry) {
	if (!entry || typeof entry !== 'object') return entry;
	return {
		...entry,
		originalName: normalizeFilename(entry.originalName),
	};
}

/**
 * 读取已上传文件清单（返回解码后的 originalName）。
 */
export function readManifest(uploadsDir) {
	return readRawManifest(uploadsDir).map(normalizeEntry);
}

/**
 * 追加一条上传记录到 manifest（写入前统一解码 originalName）。
 */
export function appendManifest(uploadsDir, entry) {
	const normalized = normalizeEntry(entry);
	const list = readRawManifest(uploadsDir);
	list.unshift(normalized);
	fs.writeFileSync(getManifestPath(uploadsDir), JSON.stringify(list, null, 2), 'utf-8');
	return normalized;
}

/**
 * 从 manifest 移除指定文件记录。
 */
export function removeFromManifest(uploadsDir, filename) {
	const list = readRawManifest(uploadsDir);
	const idx = list.findIndex((item) => item.filename === filename);
	if (idx < 0) return null;
	const [removed] = list.splice(idx, 1);
	fs.writeFileSync(getManifestPath(uploadsDir), JSON.stringify(list, null, 2), 'utf-8');
	return normalizeEntry(removed);
}

/**
 * 修复 manifest 中历史乱码文件名并写回磁盘。
 */
export function repairManifest(uploadsDir) {
	const list = readRawManifest(uploadsDir);
	if (list.length === 0) return false;

	let changed = false;
	const fixed = list.map((item) => {
		const normalized = normalizeFilename(item.originalName);
		if (normalized !== item.originalName) {
			changed = true;
		}
		return { ...item, originalName: normalized };
	});

	if (changed) {
		fs.writeFileSync(getManifestPath(uploadsDir), JSON.stringify(fixed, null, 2), 'utf-8');
	}
	return changed;
}
