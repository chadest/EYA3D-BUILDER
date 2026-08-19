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
      if (obj.name === 'Sun Light' || obj.mesh.userData.isSun) return; // The sun should not fall!
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

  /**
   * Displaces an object in real-time towards a target position using spring-damper physics forces
   */
  applySpringForceToObject(id: string, targetPos: THREE.Vector3, stiffness: number = 35.0, damping: number = 4.0) {
    if (!this.world || !this.rigidBodies.has(id)) return;
    const body = this.rigidBodies.get(id)!;
    
    // Wake up body if sleeping
    body.wakeUp();

    const currentPos = body.translation();
    const currentVel = body.linvel();

    // Spring force: F = -k * (x - target) - c * v
    const deltaX = targetPos.x - currentPos.x;
    const deltaY = targetPos.y - currentPos.y;
    const deltaZ = targetPos.z - currentPos.z;

    const forceX = deltaX * stiffness - currentVel.x * damping;
    const forceY = deltaY * stiffness - currentVel.y * damping;
    const forceZ = deltaZ * stiffness - currentVel.z * damping;

    body.applyImpulse(new RAPIER.Vector3(forceX * 0.016, forceY * 0.016, forceZ * 0.016), true);
  }

  /**
   * Radial push impulse around cursor circle
   */
  applyRadialPush(centerPos: THREE.Vector3, radius: number, pushForce: number = 15.0) {
    if (!this.world) return;

    this.rigidBodies.forEach((body) => {
      const pos = body.translation();
      const dx = pos.x - centerPos.x;
      const dy = pos.y - centerPos.y;
      const dz = pos.z - centerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius && dist > 0.01) {
        body.wakeUp();
        const factor = (1.0 - dist / radius) * pushForce * 0.02;
        const normX = (dx / dist) * factor;
        const normY = Math.max(0.05, (dy / dist) * factor + 0.02); // slight upward lift
        const normZ = (dz / dist) * factor;

        body.applyImpulse(new RAPIER.Vector3(normX, normY, normZ), true);
      }
    });
  }

  getRigidBody(id: string): RAPIER.RigidBody | undefined {
    return this.rigidBodies.get(id);
  }

  /**
   * Adds a new dynamic rigid body during an active simulation (e.g. fragments after explosion)
   */
  addDynamicBody(id: string, mesh: THREE.Mesh): RAPIER.RigidBody | undefined {
    if (!this.world) return undefined;
    this.setupDynamicCollider(id, mesh);
    return this.rigidBodies.get(id);
  }

  /**
   * Applies linear impulse and torque to a rigid body
   */
  applyImpulseAndTorque(id: string, impulse: THREE.Vector3, torque: THREE.Vector3) {
    if (!this.world || !this.rigidBodies.has(id)) return;
    const body = this.rigidBodies.get(id)!;
    body.wakeUp();
    body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
    body.applyTorqueImpulse(new RAPIER.Vector3(torque.x, torque.y, torque.z), true);
  }

  /**
   * Removes a rigid body from the physics world
   */
  removeBody(id: string) {
    if (!this.world || !this.rigidBodies.has(id)) return;
    const body = this.rigidBodies.get(id)!;
    this.world.removeRigidBody(body);
    this.rigidBodies.delete(id);
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
