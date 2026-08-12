/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Realistic Render Mode Pipeline for Three.js (EffectComposer, SSAO, Bloom, SMAA, Studio HDRI)
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class RealisticRenderPipeline {
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private outputPass: OutputPass | null = null;

  private studioEnvTexture: THREE.Texture | null = null;
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private originalSceneEnv: THREE.Texture | null = null;
  private originalSceneBg: THREE.Color | THREE.Texture | null = null;

  private width: number = 1;
  private height: number = 1;

  public init(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.width = renderer.domElement.clientWidth || window.innerWidth;
    this.height = renderer.domElement.clientHeight || window.innerHeight;

    // 1. Setup PMREM RoomEnvironment for Realistic Studio HDRI Lighting & Reflections
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.studioEnvTexture = this.pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();

    // 2. Setup Post-Processing EffectComposer
    this.composer = new EffectComposer(renderer);
    
    // Pass 1: Standard Scene Render
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Pass 2: Screen Space Ambient Occlusion (SSAO / Contact Shadows)
    this.ssaoPass = new SSAOPass(scene, camera, this.width, this.height);
    this.ssaoPass.kernelRadius = 12;
    this.ssaoPass.minDistance = 0.005;
    this.ssaoPass.maxDistance = 0.15;
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.composer.addPass(this.ssaoPass);

    // Pass 3: Subtle Bloom for Reflective / High-light Surfaces
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      0.25, // Strength (subtle glow)
      0.4,  // Radius
      0.85  // Threshold (only bright reflections)
    );
    this.composer.addPass(this.bloomPass);

    // Pass 4: Subpixel Morphological Antialiasing (SMAA)
    this.smaaPass = new SMAAPass();
    if (this.smaaPass.setSize) {
      this.smaaPass.setSize(this.width, this.height);
    }
    this.composer.addPass(this.smaaPass);

    // Pass 5: Color Management / Output Pass
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  public enableRenderEnvironment(scene: THREE.Scene): void {
    if (!this.originalSceneEnv) {
      this.originalSceneEnv = scene.environment;
      this.originalSceneBg = scene.background;
    }

    if (this.studioEnvTexture) {
      scene.environment = this.studioEnvTexture;
    }
  }

  public disableRenderEnvironment(scene: THREE.Scene): void {
    if (this.originalSceneEnv !== undefined) {
      scene.environment = this.originalSceneEnv;
      this.originalSceneBg = null;
    }
  }

  public setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height);
    }
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.composer) {
      if (this.renderPass) this.renderPass.camera = camera;
      if (this.ssaoPass) this.ssaoPass.camera = camera;
      this.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  public dispose(): void {
    if (this.studioEnvTexture) {
      this.studioEnvTexture.dispose();
      this.studioEnvTexture = null;
    }
    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = null;
    }
    this.composer = null;
  }
}
