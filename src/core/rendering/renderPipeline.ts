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

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

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
  private hasSavedEnv = false;

  private width: number = 1;
  private height: number = 1;
  private isSoftwareGl: boolean = false;

  public init(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    isSoftwareGl: boolean = false
  ): void {
    this.width = Math.max(1, renderer.domElement.clientWidth || window.innerWidth);
    this.height = Math.max(1, renderer.domElement.clientHeight || window.innerHeight);
    this.isSoftwareGl = isSoftwareGl;

    // 1. Setup PMREM RoomEnvironment for Realistic Studio HDRI Lighting & Reflections on every device
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.studioEnvTexture = this.pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();

    // Baseline scene environment ensures metallic PBR materials render accurately in preview too
    if (!scene.environment) {
      scene.environment = this.studioEnvTexture;
    }

    // Skip expensive multi-pass post-processing (SSAO/Bloom/SMAA) on software WebGL renderers
    if (this.isSoftwareGl) {
      return;
    }

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
    if (!this.hasSavedEnv) {
      this.originalSceneEnv = scene.environment;
      this.hasSavedEnv = true;
    }

    if (this.studioEnvTexture) {
      scene.environment = this.studioEnvTexture;
    }
  }

  public disableRenderEnvironment(scene: THREE.Scene): void {
    if (this.hasSavedEnv) {
      scene.environment = this.originalSceneEnv ?? this.studioEnvTexture;
      this.hasSavedEnv = false;
    }
  }

  public setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
    if (this.ssaoPass) {
      this.ssaoPass.setSize(this.width, this.height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(this.width, this.height);
    }
    if (this.smaaPass?.setSize) {
      this.smaaPass.setSize(this.width, this.height);
    }
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.composer && !this.isSoftwareGl) {
      if (this.renderPass) this.renderPass.camera = camera;
      if (this.ssaoPass) this.ssaoPass.camera = camera;
      this.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  public dispose(): void {
    if (this.ssaoPass) {
      this.ssaoPass.dispose?.();
      this.ssaoPass = null;
    }
    if (this.bloomPass) {
      this.bloomPass.dispose?.();
      this.bloomPass = null;
    }
    if (this.smaaPass) {
      this.smaaPass.dispose?.();
      this.smaaPass = null;
    }
    if (this.outputPass) {
      this.outputPass.dispose?.();
      this.outputPass = null;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.studioEnvTexture) {
      this.studioEnvTexture.dispose();
      this.studioEnvTexture = null;
    }
    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = null;
    }
  }
}
