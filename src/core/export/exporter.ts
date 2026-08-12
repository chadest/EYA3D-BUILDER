/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 3D Exporter Utility (OBJ, STL format export)
 */

import * as THREE from 'three';

/**
 * Exports a Three.js Mesh to Wavefront OBJ string format.
 */
export function exportToOBJ(mesh: THREE.Mesh): string {
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const posAttr = geom.attributes.position;
  const normAttr = geom.attributes.normal;
  const count = posAttr.count;

  let objStr = `# PolyCraft 3D Studio OBJ Export\n`;
  objStr += `o ${mesh.name || 'PolyCraftMesh'}\n\n`;

  // Vertices
  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    objStr += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
  }

  // Normals
  if (normAttr) {
    for (let i = 0; i < count; i++) {
      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);
      objStr += `vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
    }
  }

  // Faces
  for (let i = 0; i < count; i += 3) {
    const v1 = i + 1;
    const v2 = i + 2;
    const v3 = i + 3;
    objStr += `f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}\n`;
  }

  return objStr;
}

/**
 * Exports a Three.js Mesh to ASCII STL string format.
 */
export function exportToSTL(mesh: THREE.Mesh): string {
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const posAttr = geom.attributes.position;
  const normAttr = geom.attributes.normal;
  const count = posAttr.count;

  let stlStr = `solid ${mesh.name || 'PolyCraftMesh'}\n`;

  for (let i = 0; i < count; i += 3) {
    const nx = normAttr ? normAttr.getX(i) : 0;
    const ny = normAttr ? normAttr.getY(i) : 1;
    const nz = normAttr ? normAttr.getZ(i) : 0;

    stlStr += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
    stlStr += `    outer loop\n`;

    for (let j = 0; j < 3; j++) {
      const x = posAttr.getX(i + j);
      const y = posAttr.getY(i + j);
      const z = posAttr.getZ(i + j);
      stlStr += `      vertex ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
    }

    stlStr += `    endloop\n`;
    stlStr += `  endfacet\n`;
  }

  stlStr += `endsolid ${mesh.name || 'PolyCraftMesh'}\n`;
  return stlStr;
}

/**
 * Triggers file download in browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
