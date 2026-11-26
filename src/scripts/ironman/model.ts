// 文件说明：3D 火柴人模型构建，由红色圆柱体（骨骼）与球体（关节）组成上半身骨架。
import * as THREE from 'three';

/** 火柴人关节键名 */
export type JointKey =
	| 'head'
	| 'lShoulder'
	| 'rShoulder'
	| 'lElbow'
	| 'rElbow'
	| 'lWrist'
	| 'rWrist'
	| 'lHip'
	| 'rHip'
	| 'shoulderCenter';

/** 骨骼连接定义：from → to */
export interface BoneDef {
	key: string;
	from: JointKey;
	to: JointKey;
}

/** 火柴人 rig：关节球体 + 骨骼圆柱 + 默认 T-pose 关节坐标 */
export interface StickmanRig {
	root: THREE.Group;
	joints: Record<JointKey, THREE.Mesh>;
	bones: Record<string, THREE.Mesh>;
	defaultJoints: Record<JointKey, THREE.Vector3>;
}

/** 关节球体半径 */
const JOINT_RADIUS = 0.06;
/** 骨骼圆柱半径 */
const BONE_RADIUS = 0.025;
/** 圆柱默认高度（通过 scale.y 拉伸至实际骨长） */
const BONE_UNIT_HEIGHT = 1;

/** 上半身骨骼连接表 */
export const BONE_DEFS: BoneDef[] = [
	{ key: 'torso_shoulder', from: 'lShoulder', to: 'rShoulder' },
	{ key: 'torso_l', from: 'lShoulder', to: 'lHip' },
	{ key: 'torso_r', from: 'rShoulder', to: 'rHip' },
	{ key: 'torso_hip', from: 'lHip', to: 'rHip' },
	{ key: 'neck', from: 'shoulderCenter', to: 'head' },
	{ key: 'arm_l_upper', from: 'lShoulder', to: 'lElbow' },
	{ key: 'arm_l_lower', from: 'lElbow', to: 'lWrist' },
	{ key: 'arm_r_upper', from: 'rShoulder', to: 'rElbow' },
	{ key: 'arm_r_lower', from: 'rElbow', to: 'rWrist' },
];

const ALL_JOINT_KEYS: JointKey[] = [
	'head',
	'lShoulder',
	'rShoulder',
	'lElbow',
	'rElbow',
	'lWrist',
	'rWrist',
	'lHip',
	'rHip',
	'shoulderCenter',
];

/**
 * 创建纯红色标准材质（#FF0000）。
 */
function makeRedMat(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: 0xff0000,
		metalness: 0.2,
		roughness: 0.6,
	});
}

/**
 * 构建默认 T-pose 关节坐标（局部空间，肩宽约 0.6，双臂水平）。
 */
export function buildDefaultTposeJoints(): Record<JointKey, THREE.Vector3> {
	const lShoulder = new THREE.Vector3(-0.3, 1.0, 0);
	const rShoulder = new THREE.Vector3(0.3, 1.0, 0);
	const lHip = new THREE.Vector3(-0.15, 0.6, 0);
	const rHip = new THREE.Vector3(0.15, 0.6, 0);
	return {
		head: new THREE.Vector3(0, 1.25, 0),
		lShoulder,
		rShoulder,
		lElbow: new THREE.Vector3(-0.55, 1.0, 0),
		rElbow: new THREE.Vector3(0.55, 1.0, 0),
		lWrist: new THREE.Vector3(-0.55, 0.65, 0),
		rWrist: new THREE.Vector3(0.55, 0.65, 0),
		lHip,
		rHip,
		shoulderCenter: lShoulder.clone().add(rShoulder).multiplyScalar(0.5),
	};
}

/**
 * 将圆柱体骨骼对齐到两点之间：中点定位、Y 轴缩放、lookAt 朝向。
 */
export function alignBone(bone: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
	const dir = new THREE.Vector3().subVectors(to, from);
	const len = dir.length();
	if (len < 1e-4) {
		bone.visible = false;
		return;
	}
	bone.visible = true;
	bone.position.copy(from).addScaledVector(dir, 0.5);
	bone.scale.set(1, len / BONE_UNIT_HEIGHT, 1);
	bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/**
 * 创建红色 3D 火柴人（默认 T-pose），返回 StickmanRig。
 */
export function createStickman(): StickmanRig {
	const root = new THREE.Group();
	root.position.y = 0.2;

	const mat = makeRedMat();
	const defaultJoints = buildDefaultTposeJoints();
	const joints = {} as Record<JointKey, THREE.Mesh>;

	for (const key of ALL_JOINT_KEYS) {
		const sphere = new THREE.Mesh(new THREE.SphereGeometry(JOINT_RADIUS, 12, 12), mat);
		sphere.position.copy(defaultJoints[key]);
		root.add(sphere);
		joints[key] = sphere;
	}

	const bones: Record<string, THREE.Mesh> = {};
	const boneGeo = new THREE.CylinderGeometry(BONE_RADIUS, BONE_RADIUS, BONE_UNIT_HEIGHT, 8);
	for (const def of BONE_DEFS) {
		const bone = new THREE.Mesh(boneGeo, mat);
		root.add(bone);
		bones[def.key] = bone;
		alignBone(bone, defaultJoints[def.from], defaultJoints[def.to]);
	}

	return { root, joints, bones, defaultJoints };
}

/*
// 原代码注释：钢铁侠半身占位模型（已替换为火柴人）
// export interface CharacterRig { root, torsoGroup, torso, head, shoulderL, shoulderR, armL, armR, defaultPose }
// export function createPlaceholderIronMan(): CharacterRig { ... }
// export async function loadIronManModel(_gltfUrl: string): Promise<CharacterRig> { ... }
*/
