// 文件说明：Excel 工作簿多工作表预览解析，将 SheetJS 工作簿转为 HTML 表格数据。
import * as XLSX from 'xlsx';

/** 单个工作表的预览数据 */
export interface XlsxSheetPreview {
	name: string;
	html: string;
}

/**
 * 将 SheetJS 工作簿转为全部工作表的 HTML 预览数据。
 */
export function workbookToSheetPreviews(workbook: XLSX.WorkBook): XlsxSheetPreview[] {
	if (!workbook.SheetNames.length) {
		throw new Error('empty workbook');
	}

	return workbook.SheetNames.map((name) => {
		const worksheet = workbook.Sheets[name];
		const html = XLSX.utils.sheet_to_html(worksheet);
		return { name, html };
	});
}

/**
 * 从 ArrayBuffer 解析 xlsx 并返回全部工作表预览数据。
 */
export function arrayBufferToSheetPreviews(buffer: ArrayBuffer): XlsxSheetPreview[] {
	const workbook = XLSX.read(buffer, { type: 'array' });
	return workbookToSheetPreviews(workbook);
}
