import * as THREE from 'three';

export class StudioCyclorama {
  public mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(color: string) {
    // 1. Create a 2D Shape representing the 'L' profile
    // Horizontal floor = 20 units (from -10 to 8), curve radius = 2 units (from 8 to 10), vertical wall = 15 units (from 2 to 15)
    const shape = new THREE.Shape();
    shape.moveTo(-10, 0);
    shape.lineTo(8, 0); // floor line
    shape.absarc(8, 2, 2, -Math.PI / 2, 0, false); // smooth bottom curve with radius 2
    shape.lineTo(10, 15); // vertical backdrop line
    shape.lineTo(9.8, 15); // thickness 0.2
    shape.lineTo(9.8, 2); // inner vertical line
    shape.absarc(8, 2, 1.8, 0, -Math.PI / 2, true); // smooth inner curve with radius 1.8 (thickness 0.2)
    shape.lineTo(-10, 0.2); // inner floor line
    shape.lineTo(-10, 0); // close profile shape

    // 2. Extrude the L profile to create a wide backdrop surface
    const extrudeSettings = {
      steps: 1,
      depth: 30, // 30 units wide to cover background of viewport camera
      bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center it on depth axis (Z) and shift down on Y so the inner floor top is exactly at Y = 0
    geometry.translate(0, -0.2, -15);

    // 3. Configure realistic PBR Studio Backdrop Material
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.8, // Matte to avoid sharp reflections
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true; // Essential to receive soft shadow maps
    this.mesh.castShadow = false; // Only receives shadows from scene models
    this.mesh.name = 'StudioCyclorama';
    this.mesh.visible = false; // Disabled by default, controlled via Render Mode
  }

  public setColor(color: string): void {
    if (this.material) {
      this.material.color.set(color);
    }
  }

  public setVisible(visible: boolean): void {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}
