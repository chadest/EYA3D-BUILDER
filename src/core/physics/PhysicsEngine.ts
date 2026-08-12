import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { editorStore } from '../../store/EditorStore';
import { StudioCyclorama } from '../../components/viewport/StudioCyclorama';

export class PhysicsEngine {
  private world: RAPIER.World | null = null;
  private isInitialized: boolean = false;
  private rigidBodies: Map<string, RAPIER.RigidBody> = new Map();

  async init() {
    if (this.isInitialized) return;
    await RAPIER.init();
    this.isInitialized = true;
  }

  startSimulation(cyclorama: StudioCyclorama | null, plane: THREE.Mesh | null) {
    if (!this.isInitialized) return;
    
    // Create new world
    const gravity = new RAPIER.Vector3(0, -9.81, 0);
    this.world = new RAPIER.World(gravity);
    this.rigidBodies.clear();

    // Setup Cyclorama Collider
    if (editorStore.backdropType === 'StudioCyclorama' && cyclorama) {
      this.setupTrimeshCollider(cyclorama.mesh, true);
    } else if (editorStore.backdropType === 'Plane' && plane) {
      this.setupCuboidCollider(plane, true);
    }

    // Setup Object Colliders
    editorStore.objects.forEach(obj => {
      if (!obj.mesh) return;
      this.setupDynamicCollider(obj.id, obj.mesh);
    });
  }

  stopSimulation() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.rigidBodies.clear();
  }

  step() {
    if (!this.world) return;
    this.world.step();

    // Sync bodies to meshes
    editorStore.objects.forEach(obj => {
      if (obj.mesh && this.rigidBodies.has(obj.id)) {
        const body = this.rigidBodies.get(obj.id)!;
        const pos = body.translation();
        const rot = body.rotation();
        obj.mesh.position.set(pos.x, pos.y, pos.z);
        obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
    });
  }

  private setupDynamicCollider(id: string, mesh: THREE.Mesh) {
    if (!this.world) return;
    
    // Create dynamic rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation(mesh.quaternion);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Compute bounding box for cuboid collider
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;
    let hx = 0.5, hy = 0.5, hz = 0.5;
    if (bbox) {
      const size = new THREE.Vector3();
      bbox.getSize(size);
      size.multiply(mesh.scale);
      hx = size.x / 2;
      hy = size.y / 2;
      hz = size.z / 2;
    }

    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setRestitution(0.2)
      .setFriction(0.5);
    this.world.createCollider(colliderDesc, rigidBody);
    
    this.rigidBodies.set(id, rigidBody);
  }

  private setupTrimeshCollider(mesh: THREE.Mesh, isFixed: boolean) {
    if (!this.world) return;

    mesh.geometry.computeVertexNormals();
    const positionAttr = mesh.geometry.attributes.position;
    const vertices = new Float32Array(positionAttr.array.length);
    for (let i = 0; i < positionAttr.array.length; i++) {
        vertices[i] = positionAttr.array[i];
    }
    
    // Scale vertices by mesh scale
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] *= mesh.scale.x;
      vertices[i+1] *= mesh.scale.y;
      vertices[i+2] *= mesh.scale.z;
    }

    let indices = new Uint32Array(0);
    if (mesh.geometry.index) {
        const indexAttr = mesh.geometry.index.array;
        indices = new Uint32Array(indexAttr.length);
        for (let i = 0; i < indexAttr.length; i++) {
            indices[i] = indexAttr[i];
        }
    } else {
        indices = new Uint32Array(vertices.length / 3);
        for(let i=0; i < indices.length; i++) {
            indices[i] = i;
        }
    }

    const rigidBodyDesc = isFixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    rigidBodyDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    rigidBodyDesc.setRotation(mesh.quaternion);

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    this.world.createCollider(colliderDesc, rigidBody);
  }

  private setupCuboidCollider(mesh: THREE.Mesh, isFixed: boolean) {
    if (!this.world) return;

    const rigidBodyDesc = isFixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    rigidBodyDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    rigidBodyDesc.setRotation(mesh.quaternion);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;
    let hx = 50, hy = 0.01, hz = 50;
    if (bbox) {
      const size = new THREE.Vector3();
      bbox.getSize(size);
      size.multiply(mesh.scale);
      hx = size.x / 2;
      hy = Math.max(0.01, size.y / 2);
      hz = size.z / 2;
    }
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    this.world.createCollider(colliderDesc, rigidBody);
  }
}

export const physicsEngine = new PhysicsEngine();
