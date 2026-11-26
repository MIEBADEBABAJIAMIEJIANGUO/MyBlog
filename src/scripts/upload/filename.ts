// 文件说明：前端文件名解码工具，与后端 normalizeFilename 逻辑一致。
/**
 * 将误按 Latin-1 解析的文件名还原为 UTF-8（含中文 CJK 时采用解码结果）。
 */
export function normalizeFilename(name: string): string {
	if (!name) return name;
	const bytes = new Uint8Array(name.length);
	for (let i = 0; i < name.length; i++) {
		bytes[i] = name.charCodeAt(i) & 0xff;
	}
	const decoded = new TextDecoder('utf-8').decode(bytes);
	if (/[\u4e00-\u9fff]/.test(decoded)) {
		return decoded;
	}
	return name;
}
