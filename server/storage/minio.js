// 文件说明：MinIO 客户端封装，负责 bucket 初始化与对象读写。
import { Client } from 'minio';
import { minioConfig, publicFileBaseUrl } from '../config/env.js';

/** @type {Client | null} */
let client = null;

/** MinIO 是否已就绪（bucket 检查/创建成功） */
let ready = false;

/** 最近一次初始化失败原因，供日志与健康检查使用 */
let lastError = null;

/**
 * MinIO 是否已就绪。
 */
export function isMinioReady() {
	return ready;
}

/**
 * 最近一次初始化失败原因。
 */
export function getMinioError() {
	return lastError;
}

/**
 * 断言 MinIO 就绪；未就绪时抛出 503 错误，避免请求卡在连接超时上。
 */
export function assertMinioReady() {
	if (ready) return;
	const err = new Error(
		`MinIO unavailable at ${minioConfig.endPoint}:${minioConfig.port}` +
			`${lastError ? ` (${lastError})` : ''} — start it with: docker compose up -d minio`,
	);
	err.status = 503;
	throw err;
}

/**
 * 获取 MinIO 客户端单例。
 */
export function getMinioClient() {
	if (!client) {
		client = new Client({
			endPoint: minioConfig.endPoint,
			port: minioConfig.port,
			useSSL: minioConfig.useSSL,
			accessKey: minioConfig.accessKey,
			secretKey: minioConfig.secretKey,
		});
	}
	return client;
}

/**
 * 初始化 bucket：不存在则创建，并设置 files/* 匿名读策略（开发环境）。
 */
export async function initMinio() {
	const minioClient = getMinioClient();
	const { bucket } = minioConfig;

	try {
		const exists = await minioClient.bucketExists(bucket);
		if (!exists) {
			await minioClient.makeBucket(bucket);
			console.log(`[upload-server] MinIO bucket created: ${bucket}`);
		}

		const policy = {
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Principal: { AWS: ['*'] },
					Action: ['s3:GetObject'],
					Resource: [`arn:aws:s3:::${bucket}/files/*`],
				},
			],
		};
		try {
			await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
		} catch (err) {
			console.warn('[upload-server] MinIO bucket policy setup skipped:', err.message);
		}
	} catch (err) {
		ready = false;
		lastError = err.message;
		throw err;
	}

	ready = true;
	lastError = null;
	console.log('[upload-server] MinIO ready');
}

/**
 * 上传对象到 MinIO。
 */
export async function putObject(objectKey, data, size, meta = {}) {
	assertMinioReady();
	const minioClient = getMinioClient();
	await minioClient.putObject(minioConfig.bucket, objectKey, data, size, meta);
}

/**
 * 从 MinIO 删除对象。
 */
export async function removeObject(objectKey) {
	assertMinioReady();
	const minioClient = getMinioClient();
	await minioClient.removeObject(minioConfig.bucket, objectKey);
}

/**
 * 生成对象的公开访问 URL（bucket 已配置匿名读时使用）。
 */
export function getPublicUrl(objectKey) {
	const base = publicFileBaseUrl.replace(/\/$/, '');
	return `${base}/${objectKey}`;
}

/**
 * 生成对象的预签名 GET URL（备用，有效期 24 小时）。
 */
export async function getPresignedUrl(objectKey) {
	assertMinioReady();
	const minioClient = getMinioClient();
	return minioClient.presignedGetObject(minioConfig.bucket, objectKey, 24 * 60 * 60);
}

/**
 * 从 MinIO 读取对象为 Buffer，供文档解析等服务端处理使用。
 */
export async function getObjectBuffer(objectKey) {
	assertMinioReady();
	const minioClient = getMinioClient();
	const stream = await minioClient.getObject(minioConfig.bucket, objectKey);
	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}
