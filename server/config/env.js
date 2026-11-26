// 文件说明：服务端环境变量读取与默认值配置。
/**
 * 读取环境变量，未设置时返回默认值。
 */
function env(key, fallback) {
	const value = process.env[key];
	return value !== undefined && value !== '' ? value : fallback;
}

// export const mongoUri = env('MONGODB_URI', 'mongodb://localhost:27017/eccentric-event');
export const mongoUri = env(
	'MONGODB_URI',
	'mongodb://127.0.0.1:27017/eccentric-event?directConnection=true&serverSelectionTimeoutMS=5000',
);

export const minioConfig = {
	// endPoint: env('MINIO_ENDPOINT', 'localhost'),
	endPoint: env('MINIO_ENDPOINT', '127.0.0.1'),
	port: Number(env('MINIO_PORT', '9000')),
	useSSL: env('MINIO_USE_SSL', 'false') === 'true',
	accessKey: env('MINIO_ACCESS_KEY', 'minioadmin'),
	secretKey: env('MINIO_SECRET_KEY', 'minioadmin'),
	bucket: env('MINIO_BUCKET', 'uploads'),
};

export const publicFileBaseUrl = env('PUBLIC_FILE_BASE_URL', 'http://localhost:9000/uploads');
