/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PolyCraft 3D Studio - Character, Animal & Object Rigging Engine
 * Handles Bone Hierarchies, Auto-Skinning, Heat Weights, Origin Pivots & Pose Controls
 */

import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';

export type RigPresetType = 'humanoid' | 'quadruped' | 'bird' | 'fish_tail' | 'simple_arm';

export type OriginPresetType = 'bottom_center' | 'center' | 'top_center' | 'min_corner' | 'max_corner';

export interface BoneDefinition {
  name: string;
  parentName: string | null;
  position: [number, number, number]; // Relative position to parent
  rotation?: [number, number, number]; // Euler angles in rad
}

export interface SkeletonRigData {
  preset: RigPresetType;
  bones: BoneDefinition[];
}

// 1. Rig Preset Definitions (Humanoid Character, Quadruped/Dog/Cat, Bird, Fish/Tail, Simple Arm)
export const RIG_PRESETS: Record<RigPresetType, { label: string; icon: string; bones: BoneDefinition[] }> = {
  humanoid: {
    label: 'Personnage Humanoïde (Bipède)',
    icon: 'User',
    bones: [
      { name: 'Root_Hips', parentName: null, position: [0, 1.0, 0] },
      { name: 'Spine_01', parentName: 'Root_Hips', position: [0, 0.25, 0] },
      { name: 'Spine_Chest', parentName: 'Spine_01', position: [0, 0.3, 0] },
      { name: 'Neck', parentName: 'Spine_Chest', position: [0, 0.2, 0] },
      { name: 'Head', parentName: 'Neck', position: [0, 0.25, 0] },
      
      // Left Arm
      { name: 'Clavicle_L', parentName: 'Spine_Chest', position: [0.15, 0.15, 0] },
      { name: 'UpperArm_L', parentName: 'Clavicle_L', position: [0.25, -0.05, 0] },
      { name: 'Forearm_L', parentName: 'UpperArm_L', position: [0.35, 0, 0] },
      { name: 'Hand_L', parentName: 'Forearm_L', position: [0.3, 0, 0] },
      
      // Right Arm
      { name: 'Clavicle_R', parentName: 'Spine_Chest', position: [-0.15, 0.15, 0] },
      { name: 'UpperArm_R', parentName: 'Clavicle_R', position: [-0.25, -0.05, 0] },
      { name: 'Forearm_R', parentName: 'UpperArm_R', position: [-0.35, 0, 0] },
      { name: 'Hand_R', parentName: 'Forearm_R', position: [-0.3, 0, 0] },
      
      // Left Leg
      { name: 'Thigh_L', parentName: 'Root_Hips', position: [0.2, -0.1, 0] },
      { name: 'Calf_L', parentName: 'Thigh_L', position: [0, -0.45, 0] },
      { name: 'Foot_L', parentName: 'Calf_L', position: [0, -0.45, 0.15] },
      
      // Right Leg
      { name: 'Thigh_R', parentName: 'Root_Hips', position: [-0.2, -0.1, 0] },
      { name: 'Calf_R', parentName: 'Thigh_R', position: [0, -0.45, 0] },
      { name: 'Foot_R', parentName: 'Calf_R', position: [0, -0.45, 0.15] },
    ],
  },

  quadruped: {
    label: 'Animal Quadrupède (Chien, Cheval, Chat)',
    icon: 'PawPrint',
    bones: [
      { name: 'Pelvis_Hips', parentName: null, position: [0, 0.8, -0.4] },
      { name: 'Spine_Mid', parentName: 'Pelvis_Hips', position: [0, 0.05, 0.4] },
      { name: 'Chest_Front', parentName: 'Spine_Mid', position: [0, 0.1, 0.4] },
      { name: 'Neck', parentName: 'Chest_Front', position: [0, 0.25, 0.25] },
      { name: 'Head', parentName: 'Neck', position: [0, 0.15, 0.2] },
      { name: 'Snout', parentName: 'Head', position: [0, -0.05, 0.2] },

      // Tail
      { name: 'Tail_01', parentName: 'Pelvis_Hips', position: [0, -0.05, -0.25] },
      { name: 'Tail_02', parentName: 'Tail_01', position: [0, 0.05, -0.25] },
      { name: 'Tail_03', parentName: 'Tail_02', position: [0, 0.1, -0.2] },

      // Front Left Leg
      { name: 'FrontShoulder_L', parentName: 'Chest_Front', position: [0.25, -0.1, 0.05] },
      { name: 'FrontUpperLeg_L', parentName: 'FrontShoulder_L', position: [0, -0.3, 0] },
      { name: 'FrontKnee_L', parentName: 'FrontUpperLeg_L', position: [0, -0.25, -0.05] },
      { name: 'FrontPaw_L', parentName: 'FrontKnee_L', position: [0, -0.2, 0.08] },

      // Front Right Leg
      { name: 'FrontShoulder_R', parentName: 'Chest_Front', position: [-0.25, -0.1, 0.05] },
      { name: 'FrontUpperLeg_R', parentName: 'FrontShoulder_R', position: [0, -0.3, 0] },
      { name: 'FrontKnee_R', parentName: 'FrontUpperLeg_R', position: [0, -0.25, -0.05] },
      { name: 'FrontPaw_R', parentName: 'FrontKnee_R', position: [0, -0.2, 0.08] },

      // Rear Left Leg
      { name: 'RearHip_L', parentName: 'Pelvis_Hips', position: [0.25, -0.1, -0.05] },
      { name: 'RearUpperLeg_L', parentName: 'RearHip_L', position: [0, -0.3, 0] },
      { name: 'RearHock_L', parentName: 'RearUpperLeg_L', position: [0, -0.25, -0.08] },
      { name: 'RearPaw_L', parentName: 'RearHock_L', position: [0, -0.2, 0.1] },

      // Rear Right Leg
      { name: 'RearHip_R', parentName: 'Pelvis_Hips', position: [-0.25, -0.1, -0.05] },
      { name: 'RearUpperLeg_R', parentName: 'RearHip_R', position: [0, -0.3, 0] },
      { name: 'RearHock_R', parentName: 'RearUpperLeg_R', position: [0, -0.25, -0.08] },
      { name: 'RearPaw_R', parentName: 'RearHock_R', position: [0, -0.2, 0.1] },
    ],
  },

  bird: {
    label: 'Animal Ailé / Oiseau',
    icon: 'Feather',
    bones: [
      { name: 'Body_Root', parentName: null, position: [0, 0.8, 0] },
      { name: 'Chest', parentName: 'Body_Root', position: [0, 0.15, 0.2] },
      { name: 'Neck', parentName: 'Chest', position: [0, 0.2, 0.15] },
      { name: 'Head_Beak', parentName: 'Neck', position: [0, 0.15, 0.15] },
      { name: 'Tail_Feathers', parentName: 'Body_Root', position: [0, -0.05, -0.35] },

      // Left Wing
      { name: 'Wing_Shoulder_L', parentName: 'Chest', position: [0.2, 0.05, 0.05] },
      { name: 'Wing_Elbow_L', parentName: 'Wing_Shoulder_L', position: [0.4, 0.1, -0.1] },
      { name: 'Wing_Tip_L', parentName: 'Wing_Elbow_L', position: [0.45, -0.05, -0.15] },

      // Right Wing
      { name: 'Wing_Shoulder_R', parentName: 'Chest', position: [-0.2, 0.05, 0.05] },
      { name: 'Wing_Elbow_R', parentName: 'Wing_Shoulder_R', position: [-0.4, 0.1, -0.1] },
      { name: 'Wing_Tip_R', parentName: 'Wing_Elbow_R', position: [-0.45, -0.05, -0.15] },

      // Legs / Talons
      { name: 'Talon_L', parentName: 'Body_Root', position: [0.15, -0.35, 0] },
      { name: 'Talon_R', parentName: 'Body_Root', position: [-0.15, -0.35, 0] },
    ],
  },

  fish_tail: {
    label: 'Créature Aquatique / Serpent / Queue',
    icon: 'Waves',
    bones: [
      { name: 'Root_Head', parentName: null, position: [0, 0.5, 0.6] },
      { name: 'Body_01', parentName: 'Root_Head', position: [0, 0, -0.3] },
      { name: 'Body_02', parentName: 'Body_01', position: [0, 0, -0.35] },
      { name: 'Body_03', parentName: 'Body_02', position: [0, 0, -0.35] },
      { name: 'Tail_Fin', parentName: 'Body_03', position: [0, 0, -0.4] },
    ],
  },

  simple_arm: {
    label: 'Bras Articulé Simple (3 Segments)',
    icon: 'Share2',
    bones: [
      { name: 'Base', parentName: null, position: [0, 0, 0] },
      { name: 'Segment_01', parentName: 'Base', position: [0, 0.6, 0] },
      { name: 'Segment_02', parentName: 'Segment_01', position: [0, 0.6, 0] },
      { name: 'End_Effector', parentName: 'Segment_02', position: [0, 0.4, 0] },
    ],
  },
};

export class RiggingEngine {
  private static instance: RiggingEngine;

  public static getInstance(): RiggingEngine {
    if (!RiggingEngine.instance) {
      RiggingEngine.instance = new RiggingEngine();
    }
    return RiggingEngine.instance;
  }

  // ==========================================
  // SECTION 1: ORIGIN / PIVOT POINT ADJUSTMENT
  // ==========================================

  /**
   * Sets the pivot origin of an object or animal without moving its visual position in world space.
   * Modifies the underlying geometry attributes and counter-offsets the mesh position.
   */
  public setOriginPreset(mesh: THREE.Mesh, preset: OriginPresetType): void {
    if (!mesh || !mesh.geometry) return;
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    if (!bbox) return;

    const currentCenter = new THREE.Vector3();
    bbox.getCenter(currentCenter);

    let offset = new THREE.Vector3();

    switch (preset) {
      case 'bottom_center':
        // Pivot at bottom center (ground level: X_mid, Y_min, Z_mid)
        offset.set(currentCenter.x, bbox.min.y, currentCenter.z);
        break;
      case 'center':
        // Pivot at geometric center of mass (X_mid, Y_mid, Z_mid)
        offset.set(currentCenter.x, currentCenter.y, currentCenter.z);
        break;
      case 'top_center':
        // Pivot at top center (X_mid, Y_max, Z_mid)
        offset.set(currentCenter.x, bbox.max.y, currentCenter.z);
        break;
      case 'min_corner':
        // Pivot at min corner (X_min, Y_min, Z_min)
        offset.set(bbox.min.x, bbox.min.y, bbox.min.z);
        break;
      case 'max_corner':
        // Pivot at max corner (X_max, Y_max, Z_max)
        offset.set(bbox.max.x, bbox.max.y, bbox.max.z);
        break;
    }

    this.translateOrigin(mesh, offset);
  }

  /**
   * Translates the geometry so that targetOffset in local coordinates becomes the new (0,0,0) local origin.
   */
  public translateOrigin(mesh: THREE.Mesh, localOffset: THREE.Vector3): void {
    if (!mesh || !mesh.geometry) return;
    const geometry = mesh.geometry;

    // Shift geometry coordinates by -localOffset
    geometry.translate(-localOffset.x, -localOffset.y, -localOffset.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Counter-shift mesh in world coordinates so visual placement remains strictly identical
    const worldOffset = localOffset.clone().applyQuaternion(mesh.quaternion).multiply(mesh.scale);
    mesh.position.add(worldOffset);
    mesh.updateMatrixWorld(true);

    editorStore.notify();
  }

  // ==========================================
  // SECTION 2: SKELETON HIERARCHY GENERATION
  // ==========================================

  /**
   * Creates a THREE.Bone hierarchy scaled and fitted to the target mesh bounding box.
   */
  public createSkeletonFromPreset(
    presetKey: RigPresetType,
    targetMesh?: THREE.Mesh
  ): { rootBone: THREE.Bone; bones: THREE.Bone[]; skeleton: THREE.Skeleton } {
    const preset = RIG_PRESETS[presetKey];
    if (!preset) throw new Error(`Unknown rig preset: ${presetKey}`);

    // Compute bounding scale and center if targetMesh provided
    let scaleX = 1, scaleY = 1, scaleZ = 1;
    let center = new THREE.Vector3(0, 0, 0);

    if (targetMesh && targetMesh.geometry) {
      targetMesh.geometry.computeBoundingBox();
      const bbox = targetMesh.geometry.boundingBox;
      if (bbox) {
        const size = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        // Adjust scale factors proportional to mesh dimension
        scaleX = Math.max(size.x, 0.2);
        scaleY = Math.max(size.y, 0.2);
        scaleZ = Math.max(size.z, 0.2);
      }
    }

    const boneMap = new Map<string, THREE.Bone>();
    const bones: THREE.Bone[] = [];
    let rootBone: THREE.Bone | null = null;

    // 1. Create all bone instances
    for (const def of preset.bones) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.set(
        def.position[0] * (presetKey === 'humanoid' ? scaleX * 0.8 : scaleX),
        def.position[1] * (presetKey === 'humanoid' ? scaleY * 0.9 : scaleY),
        def.position[2] * (presetKey === 'humanoid' ? scaleZ * 0.8 : scaleZ)
      );
      if (def.rotation) {
        bone.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
      }
      boneMap.set(def.name, bone);
      bones.push(bone);
    }

    // 2. Link Parent -> Child relationships
    for (const def of preset.bones) {
      const bone = boneMap.get(def.name)!;
      if (def.parentName) {
        const parent = boneMap.get(def.parentName);
        if (parent) {
          parent.add(bone);
        }
      } else {
        rootBone = bone;
        if (targetMesh) {
          rootBone.position.add(center);
        }
      }
    }

    if (!rootBone) {
      rootBone = bones[0];
    }

    const skeleton = new THREE.Skeleton(bones);
    return { rootBone, bones, skeleton };
  }

  // ==========================================
  // SECTION 3: AUTOMATED HEAT/DISTANCE SKINNING
  // ==========================================

  /**
   * Performs automatic heat/distance skinning from a Mesh to a Skeleton.
   * Converts a standard THREE.Mesh into a hardware GPU-accelerated THREE.SkinnedMesh.
   */
  public autoSkinMesh(
    mesh: THREE.Mesh,
    rootBone: THREE.Bone,
    skeleton: THREE.Skeleton
  ): THREE.SkinnedMesh {
    if (!mesh || !mesh.geometry || typeof mesh.geometry.clone !== 'function') {
      throw new Error("Target mesh has no valid geometry for skinning.");
    }
    let sourceGeom = mesh.geometry.clone();
    // Ensure non-indexed or indexed buffer geometry has position attribute
    const positionAttr = sourceGeom.getAttribute('position');
    if (!positionAttr) {
      throw new Error("Target mesh geometry has no position attribute.");
    }
    const vertexCount = positionAttr.count;

    const skinIndices: number[] = [];
    const skinWeights: number[] = [];

    // Pre-calculate bone world positions in bind pose
    mesh.updateMatrixWorld(true);
    rootBone.updateMatrixWorld(true);

    const bonePositions: THREE.Vector3[] = [];
    const bonePairs: { start: THREE.Vector3; end: THREE.Vector3; index: number }[] = [];

    for (let i = 0; i < skeleton.bones.length; i++) {
      const b = skeleton.bones[i];
      const worldPos = new THREE.Vector3();
      b.getWorldPosition(worldPos);
      // Convert to mesh local coordinate space
      mesh.worldToLocal(worldPos);
      bonePositions.push(worldPos);

      // If bone has children, construct segments
      if (b.children.length > 0) {
        for (const child of b.children) {
          if (child instanceof THREE.Bone) {
            const childPos = new THREE.Vector3();
            child.getWorldPosition(childPos);
            mesh.worldToLocal(childPos);
            bonePairs.push({ start: worldPos, end: childPos, index: i });
          }
        }
      } else {
        // Tip bone: segment to self + small offset
        bonePairs.push({ start: worldPos, end: worldPos.clone().add(new THREE.Vector3(0, 0.1, 0)), index: i });
      }
    }

    // Gaussian inverse falloff constant
    const tempV = new THREE.Vector3();

    for (let v = 0; v < vertexCount; v++) {
      tempV.fromBufferAttribute(positionAttr, v);

      // Compute distance to each bone / segment
      const influences: { boneIndex: number; weight: number }[] = [];

      for (let b = 0; b < skeleton.bones.length; b++) {
        const bonePos = bonePositions[b];
        const dist = tempV.distanceTo(bonePos);
        
        // Heat weight using Gaussian decay
        const heat = Math.exp(-Math.pow(dist, 2) / 0.35) + (1.0 / Math.max(dist * dist + 0.05, 0.05));
        influences.push({ boneIndex: b, weight: heat });
      }

      // Sort by highest weight first
      influences.sort((a, b) => b.weight - a.weight);

      // Take top 4 bones for standard WebGL 4-bone vertex skinning
      const top4 = influences.slice(0, 4);
      const totalWeight = top4.reduce((sum, inf) => sum + inf.weight, 0);

      // Normalize weights so sum = 1.0
      const w0 = totalWeight > 0.0001 ? top4[0].weight / totalWeight : 1;
      const w1 = top4[1] && totalWeight > 0.0001 ? top4[1].weight / totalWeight : 0;
      const w2 = top4[2] && totalWeight > 0.0001 ? top4[2].weight / totalWeight : 0;
      const w3 = top4[3] && totalWeight > 0.0001 ? top4[3].weight / totalWeight : 0;

      const i0 = top4[0].boneIndex;
      const i1 = top4[1] ? top4[1].boneIndex : 0;
      const i2 = top4[2] ? top4[2].boneIndex : 0;
      const i3 = top4[3] ? top4[3].boneIndex : 0;

      skinIndices.push(i0, i1, i2, i3);
      skinWeights.push(w0, w1, w2, w3);
    }

    sourceGeom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    sourceGeom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    // Clone material & enable skinning shader defines
    const material = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
    if ('skinning' in material) {
      (material as any).skinning = true;
    }

    const skinnedMesh = new THREE.SkinnedMesh(sourceGeom, material);
    skinnedMesh.name = `${mesh.name}_Rigged`;
    skinnedMesh.position.copy(mesh.position);
    skinnedMesh.quaternion.copy(mesh.quaternion);
    skinnedMesh.scale.copy(mesh.scale);
    skinnedMesh.castShadow = mesh.castShadow;
    skinnedMesh.receiveShadow = mesh.receiveShadow;

    // Attach root bone and bind skeleton
    skinnedMesh.add(rootBone);
    skinnedMesh.bind(skeleton);

    return skinnedMesh;
  }

  /**
   * Resets all bones in a skeleton to their neutral T-Pose/Bind Pose.
   */
  public resetToRestPose(skeleton: THREE.Skeleton): void {
    if (!skeleton) return;
    for (const bone of skeleton.bones) {
      bone.position.set(0, 0, 0);
      bone.rotation.set(0, 0, 0);
      bone.scale.set(1, 1, 1);
    }
    // Re-evaluate matrices
    if (skeleton.bones.length > 0) {
      skeleton.bones[0].updateMatrixWorld(true);
    }
    skeleton.update();
    editorStore.notify();
  }
}

export const riggingEngine = RiggingEngine.getInstance();
