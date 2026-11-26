// 文件说明：修复 multipart 上传时中文等非 ASCII 文件名的乱码问题。
/**
 * 将 Multer/Busboy 按 Latin-1 误解析的文件名还原为 UTF-8。
 * 已是正确 Unicode 的名称（如 JSON 传入的 file.name）不会被改动。
 */
export function normalizeFilename(name) {
	if (!name || typeof name !== 'string') return name;
	// 原代码注释：先匹配 Latin-1 区再解码
	// if (!/[\u0080-\u00ff]/.test(name)) return name;
	const decoded = Buffer.from(name, 'latin1').toString('utf8');
	if (/[\u4e00-\u9fff]/.test(decoded)) {
		return decoded;
	}
	return name;
}
