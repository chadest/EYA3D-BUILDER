/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Eya3D Studio - High-Resolution 3D Extruded Text Primitive & Fallback Plaque Generator
 */

import * as THREE from 'three';
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { editorStore } from '../../store/EditorStore';

let cachedFont: Font | null = null;

/**
 * Loads standard Helvetiker font asynchronously from a highly reliable public CDN.
 */
export async function getStandardFont(): Promise<Font> {
  if (cachedFont) return cachedFont;
  const loader = new FontLoader();
  // Using the official verified font from the mrdoob/three.js repository on raw.githubusercontent.com
  const fontUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/fonts/helvetiker_regular.typeface.json';
  const fontData = await fetch(fontUrl).then(res => res.json());
  cachedFont = loader.parse(fontData);
  return cachedFont;
}

/**
 * Creates a high-resolution CanvasTexture representing the provided text.
 */
export function createTextCanvasTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  ctx.font = 'bold 120px "Segoe UI", -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width) + 80;
  const textHeight = 160;

  canvas.width = textWidth;
  canvas.height = textHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.font = 'bold 120px "Segoe UI", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates a 3D Box/Plaque with the text crisp and cleanly mapped onto both front and back faces.
 */
export function createTextCanvasPlaqueGeometry(text: string, size: number = 1.0, height: number = 0.2) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 120px "Segoe UI", -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width) + 80;
  const textHeight = 160;
  const aspect = textWidth / textHeight;

  const plaqueWidth = aspect * size;
  const plaqueHeight = size;
  const plaqueDepth = height;

  const geometry = new THREE.BoxGeometry(plaqueWidth, plaqueHeight, plaqueDepth);
  geometry.center();

  const texture = createTextCanvasTexture(text);
  const faceMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  return { geometry, material: faceMat };
}

/**
 * Generates a 3D Extruded Text Mesh. Centers the geometry pivot at its center of gravity.
 */
export function createTextPrimitiveMesh(
  text: string,
  color: string = '#4a90e2',
  height: number = 0.1,
  size: number = 1.0
): THREE.Mesh {
  // 1. Create a lightweight temporary box geometry that aligns perfectly in space
  const tempGeom = new THREE.BoxGeometry(size * text.length * 0.45, size, height);
  tempGeom.center();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.3,
    metalness: 0.1,
    flatShading: editorStore.flatShading,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(tempGeom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.userData.isText = true;
  mesh.userData.textValue = text;
  mesh.userData.colorValue = color;
  mesh.userData.height = height;
  mesh.userData.size = size;

  // 2. Load the actual 3D font and swap with the correct TextGeometry
  getStandardFont().then(font => {
    try {
      const textGeom = new TextGeometry(text, {
        font: font,
        size: size,
        depth: height,
        curveSegments: 4,
        bevelEnabled: false, // Temporarily disabled to avoid filling anomalies
        bevelThickness: size * 0.02,
        bevelSize: size * 0.005,
        bevelOffset: 0,
        bevelSegments: 2
      });
      textGeom.center(); // Center of gravity pivot alignment!

      const oldGeom = mesh.geometry;
      mesh.geometry = textGeom as any;
      if (oldGeom) {
        oldGeom.dispose(); // GPU memory cleanup
      }
      mesh.geometry.computeVertexNormals();
      editorStore.notify();
    } catch (e) {
      console.warn("Failed to generate TextGeometry, falling back to plaque", e);
      fallbackUpdate(mesh, text, color, height, size);
    }
  }).catch(() => {
    fallbackUpdate(mesh, text, color, height, size);
  });

  return mesh;
}

/**
 * Safely updates the text mesh in-place. Maintains shadows and centers gravity.
 */
export function updateTextPrimitiveMesh(
  mesh: THREE.Mesh,
  text: string,
  color: string,
  height?: number,
  size?: number
) {
  const currentHeight = height !== undefined ? height : (mesh.userData.height !== undefined ? mesh.userData.height : 0.1);
  const currentSize = size !== undefined ? size : (mesh.userData.size !== undefined ? mesh.userData.size : 1.0);

  mesh.userData.textValue = text;
  mesh.userData.colorValue = color;
  mesh.userData.height = currentHeight;
  mesh.userData.size = currentSize;

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(mat => {
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.color.set(color);
      mat.flatShading = editorStore.flatShading;
    }
  });

  getStandardFont().then(font => {
    try {
      const textGeom = new TextGeometry(text, {
        font: font,
        size: currentSize,
        depth: currentHeight,
        curveSegments: 4,
        bevelEnabled: false, // Temporarily disabled to avoid filling anomalies
        bevelThickness: currentSize * 0.02,
        bevelSize: currentSize * 0.005,
        bevelOffset: 0,
        bevelSegments: 2
      });
      textGeom.center(); // Recenter gravity!

      const oldGeom = mesh.geometry;
      mesh.geometry = textGeom as any;
      if (oldGeom) {
        oldGeom.dispose(); // GPU memory cleanup
      }
      mesh.geometry.computeVertexNormals();
      editorStore.notify();
    } catch (e) {
      fallbackUpdate(mesh, text, color, currentHeight, currentSize);
    }
  }).catch(() => {
    fallbackUpdate(mesh, text, color, currentHeight, currentSize);
  });
}

function fallbackUpdate(mesh: THREE.Mesh, text: string, color: string, height: number, size: number) {
  const plaque = createTextCanvasPlaqueGeometry(text, size, height);
  mesh.geometry.dispose();
  mesh.geometry = plaque.geometry;
  
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(m => m.dispose());
  } else if (mesh.material) {
    mesh.material.dispose();
  }

  mesh.material = plaque.material;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(m => {
    if (m instanceof THREE.MeshStandardMaterial) {
      m.color.set(color);
    }
  });
  editorStore.notify();
}
