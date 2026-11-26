// 文件说明：统一 API 响应格式工具，所有上传接口返回 { code, success, message, data? }。
import { UploadStatusCode, StatusMessages } from '../constants/upload.js';

/**
 * 发送成功响应。
 */
export function sendOk(res, data = null, message = StatusMessages[UploadStatusCode.SUCCESS]) {
	const body = {
		code: UploadStatusCode.SUCCESS,
		success: true,
		message,
	};
	if (data !== null) {
		body.data = data;
	}
	return res.json(body);
}

/**
 * 发送错误响应。
 */
export function sendError(res, code, message = StatusMessages[code], httpStatus = 400) {
	return res.status(httpStatus).json({
		code,
		success: false,
		message: message ?? StatusMessages[code] ?? 'Unknown error',
	});
}
