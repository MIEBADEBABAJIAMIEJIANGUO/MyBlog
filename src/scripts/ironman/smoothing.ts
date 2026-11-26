// 文件说明：姿态驱动用的指数移动平均（EMA）平滑工具，用于减少关键点抖动。
import * as THREE from 'three';

/**
 * 对 Vector3 做指数移动平均平滑，返回当前平滑后的向量。
 */
export class EmaVector3 {
	private value = new THREE.Vector3();

	/**
	 * 用目标向量更新平滑值，alpha 越大响应越快。
	 */
	update(target: THREE.Vector3, alpha: number): THREE.Vector3 {
		this.value.lerp(target, alpha);
		return this.value;
	}

	/**
	 * 将平滑值重置为指定向量。
	 */
	reset(v: THREE.Vector3): void {
		this.value.copy(v);
	}

	/**
	 * 获取当前平滑后的向量副本。
	 */
	get(): THREE.Vector3 {
		return this.value.clone();
	}

	/**
	 * 直接读取内部向量引用（只读用途）。
	 */
	ref(): THREE.Vector3 {
		return this.value;
	}
}

/**
 * 对 Quaternion 做球面线性插值平滑，返回当前平滑后的四元数。
 */
export class EmaQuaternion {
	private value = new THREE.Quaternion();

	/**
	 * 用目标四元数更新平滑值，alpha 越大响应越快。
	 */
	update(target: THREE.Quaternion, alpha: number): THREE.Quaternion {
		this.value.slerp(target, alpha);
		return this.value;
	}

	/**
	 * 将平滑值重置为指定四元数。
	 */
	reset(q: THREE.Quaternion): void {
		this.value.copy(q);
	}

	/**
	 * 获取当前平滑后的四元数副本。
	 */
	get(): THREE.Quaternion {
		return this.value.clone();
	}

	/**
	 * 直接读取内部四元数引用（只读用途）。
	 */
	ref(): THREE.Quaternion {
		return this.value;
	}
}

/**
 * 对标量做指数移动平均平滑，返回当前平滑后的数值。
 */
export class EmaScalar {
	private value = 0;

	/**
	 * 用目标标量更新平滑值，alpha 越大响应越快。
	 */
	update(target: number, alpha: number): number {
		this.value += (target - this.value) * alpha;
		return this.value;
	}

	/**
	 * 将平滑值重置为指定数值。
	 */
	reset(v: number): void {
		this.value = v;
	}

	/**
	 * 获取当前平滑后的数值。
	 */
	get(): number {
		return this.value;
	}
}
