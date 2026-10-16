import * as THREE from 'three';
import { Palette } from '../core/Config';

// Shared geometries + materials (perf: reuse everywhere, no textures in MVP).
const matCache = new Map<number, THREE.MeshLambertMaterial>();
export function mat(color: number): THREE.MeshLambertMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cone(r: number, h: number, color: number, seg = 7): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  mesh.castShadow = true;
  return mesh;
}

export function cyl(rt: number, rb: number, h: number, color: number, seg = 8): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  mesh.castShadow = true;
  return mesh;
}

export { Palette };
