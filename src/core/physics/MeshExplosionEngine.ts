import * as THREE from 'three';
import { editorStore } from '../../store/EditorStore';
import { SceneObject } from '../../types/editor';
import { physicsEngine } from './PhysicsEngine';

export interface ExplosionOptions {
  blastForce?: number;
  chunkCount?: number;
  epicenter?: THREE.Vector3;
  blastRadius?: number;
}

export class MeshExplosionEngine {
  /**
   * Explodes a SceneObject into physical 3D volumetric fragments and propels them with physics shockwave
   */
  public static explodeSolid(
    targetObj: SceneObject,
    options: ExplosionOptions = {}
  ): string[] {
    if (!targetObj.mesh) return [];

    const blastForce = options.blastForce ?? editorStore.simulationExplosionForce ?? 40.0;
    const chunkCount = options.chunkCount ?? editorStore.simulationExplosionChunks ?? 16;
    const epicenter = options.epicenter ?? targetObj.mesh.position.clone();
    const blastRadius = options.blastRadius ?? 4.0;

    const sourceMesh = targetObj.mesh;
    const sourceGeom = sourceMesh.geometry.clone().toNonIndexed();
    const sourcePosAttr = sourceGeom.attributes.position;
    const sourceNormAttr = sourceGeom.attributes.normal;
    const sourceUvAttr = sourceGeom.attributes.uv;

    // Snapshot parent / scene context and world transform
    sourceMesh.updateMatrixWorld(true);
    const worldMatrix = sourceMesh.matrixWorld.clone();
    const originalPos = sourceMesh.position.clone();

    // Determine bounding box
    sourceGeom.computeBoundingBox();
    const bbox = sourceGeom.boundingBox || new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Compute partition cells in local geometry space
    const totalTriangles = sourcePosAttr.count / 3;
    if (totalTriangles === 0) return [];

    const numChunks = Math.min(chunkCount, Math.max(4, Math.floor(totalTriangles / 2)));
    
    // Generate cluster centers inside the bounding box
    const clusterCenters: THREE.Vector3[] = [];
    for (let i = 0; i < numChunks; i++) {
      clusterCenters.push(
        new THREE.Vector3(
          bbox.min.x + Math.random() * size.x,
          bbox.min.y + Math.random() * size.y,
          bbox.min.z + Math.random() * size.z
        )
      );
    }

    // Partition triangles to closest cluster center
    const chunkTriangles: number[][] = Array.from({ length: numChunks }, () => []);

    const triCenter = new THREE.Vector3();
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();

    for (let t = 0; t < totalTriangles; t++) {
      vA.fromBufferAttribute(sourcePosAttr, t * 3);
      vB.fromBufferAttribute(sourcePosAttr, t * 3 + 1);
      vC.fromBufferAttribute(sourcePosAttr, t * 3 + 2);

      triCenter.copy(vA).add(vB).add(vC).divideScalar(3);

      let bestClusterIdx = 0;
      let minDistSq = Infinity;
      for (let c = 0; c < numChunks; c++) {
        const dSq = triCenter.distanceToSquared(clusterCenters[c]);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestClusterIdx = c;
        }
      }
      chunkTriangles[bestClusterIdx].push(t);
    }

    // Create fragments
    const createdChunkIds: string[] = [];
    const sourceMat = sourceMesh.material;

    // Track fragment meshes for physics initialization
    const fragmentMeshes: { id: string; mesh: THREE.Mesh; centerWorld: THREE.Vector3 }[] = [];

    chunkTriangles.forEach((tris, chunkIdx) => {
      if (tris.length === 0) return;

      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];

      // Calculate centroid of this chunk
      const chunkCentroid = new THREE.Vector3();
      let vertexCount = 0;

      tris.forEach(t => {
        for (let i = 0; i < 3; i++) {
          const idx = t * 3 + i;
          const px = sourcePosAttr.getX(idx);
          const py = sourcePosAttr.getY(idx);
          const pz = sourcePosAttr.getZ(idx);
          chunkCentroid.x += px;
          chunkCentroid.y += py;
          chunkCentroid.z += pz;
          vertexCount++;
        }
      });

      if (vertexCount > 0) {
        chunkCentroid.divideScalar(vertexCount);
      }

      // Fill buffers re-centered around chunkCentroid for proper rotational inertia
      tris.forEach(t => {
        for (let i = 0; i < 3; i++) {
          const idx = t * 3 + i;
          positions.push(
            sourcePosAttr.getX(idx) - chunkCentroid.x,
            sourcePosAttr.getY(idx) - chunkCentroid.y,
            sourcePosAttr.getZ(idx) - chunkCentroid.z
          );
          if (sourceNormAttr) {
            normals.push(
              sourceNormAttr.getX(idx),
              sourceNormAttr.getY(idx),
              sourceNormAttr.getZ(idx)
            );
          }
          if (sourceUvAttr) {
            uvs.push(
              sourceUvAttr.getX(idx),
              sourceUvAttr.getY(idx)
            );
          }
        }
      });

      const chunkGeom = new THREE.BufferGeometry();
      chunkGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (normals.length > 0) {
        chunkGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      } else {
        chunkGeom.computeVertexNormals();
      }
      if (uvs.length > 0) {
        chunkGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      }

      // Clone material or create high-contrast fracture material
      let chunkMat: THREE.Material;
      if (Array.isArray(sourceMat)) {
        chunkMat = sourceMat[0].clone();
      } else if (sourceMat) {
        chunkMat = sourceMat.clone();
      } else {
        chunkMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.5, metalness: 0.2 });
      }

      const chunkMesh = new THREE.Mesh(chunkGeom, chunkMat);
      chunkMesh.castShadow = true;
      chunkMesh.receiveShadow = true;

      // Transform chunk centroid to world space
      const chunkWorldPos = chunkCentroid.clone().applyMatrix4(worldMatrix);
      chunkMesh.position.copy(chunkWorldPos);
      chunkMesh.quaternion.copy(sourceMesh.quaternion);
      chunkMesh.scale.copy(sourceMesh.scale);

      const chunkName = `${targetObj.name} Fragment #${chunkIdx + 1}`;
      const newAddedObj = editorStore.addObject(chunkName, chunkMesh);
      createdChunkIds.push(newAddedObj.id);

      fragmentMeshes.push({
        id: newAddedObj.id,
        mesh: chunkMesh,
        centerWorld: chunkWorldPos
      });
    });

    // Remove the original solid object cleanly
    editorStore.removeObject(targetObj.id);

    // If physics is running or needs to start, register and propel fragments
    if (!editorStore.isPhysicsActive) {
      editorStore.isPhysicsActive = true;
    }

    // Register all fragments with the physics engine
    fragmentMeshes.forEach(frag => {
      physicsEngine.addDynamicBody(frag.id, frag.mesh);

      // Compute blast directional impulse vector from epicenter
      const dir = frag.centerWorld.clone().sub(epicenter);
      let dist = dir.length();
      if (dist < 0.05) {
        dir.set((Math.random() - 0.5) * 2, Math.random() + 0.5, (Math.random() - 0.5) * 2);
        dist = 0.1;
      }
      dir.normalize();

      // Blast intensity calculation (radial falloff + upward lift)
      const power = blastForce * (1.2 / (0.5 + dist * 0.4));
      const impulseX = dir.x * power * (0.8 + Math.random() * 0.5);
      const impulseY = Math.max(power * 0.4, (dir.y * power + power * 0.3) * (0.8 + Math.random() * 0.5)); // Upward explosion lift
      const impulseZ = dir.z * power * (0.8 + Math.random() * 0.5);

      const torqueX = (Math.random() - 0.5) * power * 0.8;
      const torqueY = (Math.random() - 0.5) * power * 0.8;
      const torqueZ = (Math.random() - 0.5) * power * 0.8;

      physicsEngine.applyImpulseAndTorque(
        frag.id,
        new THREE.Vector3(impulseX, impulseY, impulseZ),
        new THREE.Vector3(torqueX, torqueY, torqueZ)
      );
    });

    editorStore.notify();
    return createdChunkIds;
  }
}
