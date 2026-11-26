// 文件说明：IndexedDB 文件持久化，供页面刷新后恢复上传任务。
const DB_NAME = 'upload-file-store';
const STORE_NAME = 'files';
const DB_VERSION = 1;

interface StoredFileRecord {
	taskId: string;
	blob: Blob;
	name: string;
	size: number;
	type: string;
	lastModified: number;
}

/**
 * 打开 IndexedDB 数据库。
 */
function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'taskId' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * 将 File 存入 IndexedDB。
 */
export async function saveFile(taskId: string, file: File): Promise<void> {
	const db = await openDb();
	const record: StoredFileRecord = {
		taskId,
		blob: file,
		name: file.name,
		size: file.size,
		type: file.type,
		lastModified: file.lastModified,
	};
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(record);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

/**
 * 从 IndexedDB 读取 File 对象。
 */
export async function getFile(taskId: string): Promise<File | null> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).get(taskId);
		req.onsuccess = () => {
			db.close();
			const rec = req.result as StoredFileRecord | undefined;
			if (!rec) {
				resolve(null);
				return;
			}
			resolve(new File([rec.blob], rec.name, { type: rec.type, lastModified: rec.lastModified }));
		};
		req.onerror = () => {
			db.close();
			reject(req.error);
		};
	});
}

/**
 * 删除 IndexedDB 中的文件记录。
 */
export async function deleteFile(taskId: string): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).delete(taskId);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}
