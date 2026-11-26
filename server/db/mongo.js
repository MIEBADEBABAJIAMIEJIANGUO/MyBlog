// 文件说明：MongoDB 连接管理，提供数据库实例与连接方法。
import { MongoClient } from 'mongodb';
import { mongoUri } from '../config/env.js';

/** @type {MongoClient | null} */
let client = null;

/** @type {import('mongodb').Db | null} */
let db = null;

/** MongoDB 客户端连接选项（Windows + Docker 下避免长时间挂起） */
const mongoClientOptions = {
	serverSelectionTimeoutMS: 5000,
	directConnection: true,
};

/**
 * 连接 MongoDB 并缓存客户端实例；已连接时会 ping，失败则自动重连。
 */
export async function connectMongo() {
	if (db && client) {
		try {
			await db.command({ ping: 1 });
			return db;
		} catch (err) {
			console.warn('[upload-server] MongoDB ping failed, reconnecting:', err.message);
			await closeMongo();
		}
	}
	// client = new MongoClient(mongoUri);
	client = new MongoClient(mongoUri, mongoClientOptions);
	await client.connect();
	db = client.db();
	console.log('[upload-server] MongoDB connected');
	return db;
}

/**
 * 获取已连接的数据库实例。
 */
export function getDb() {
	if (!db) {
		throw new Error('MongoDB not connected. Call connectMongo() first.');
	}
	return db;
}

/**
 * 关闭 MongoDB 连接。
 */
export async function closeMongo() {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}
