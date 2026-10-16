import * as THREE from 'three';
import { Palette } from '../core/Config';
import { grassTexture, soilTexture, pathTexture, woodTexture, roofTexture, barnWallTexture } from './textures';

// Shared geometries + materials (perf: reuse everywhere, all procedural — no external assets).
const matCache = new Map<number, THREE.MeshLambertMaterial>();
export function mat(color: number): THREE.MeshLambertMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

const stdCache = new Map<string, THREE.MeshStandardMaterial>();
/** Glossy standard material for produce, glass, painted metal (cached by key). */
export function std(color: number, roughness = 0.55, metalness = 0.05): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`;
  let m = stdCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    stdCache.set(key, m);
  }
  return m;
}

function texMat(tex: THREE.Texture, rx = 1, ry = 1): THREE.MeshLambertMaterial {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return new THREE.MeshLambertMaterial({ map: t });
}

let _grass: THREE.MeshLambertMaterial | null = null;
let _soil: THREE.MeshLambertMaterial | null = null;
let _soilDry: THREE.MeshLambertMaterial | null = null;
let _path: THREE.MeshLambertMaterial | null = null;
let _wood: THREE.MeshLambertMaterial | null = null;
let _roof: THREE.MeshLambertMaterial | null = null;
let _barn: THREE.MeshLambertMaterial | null = null;
/** Textured ground/soil/path/wood/roof/barn-wall materials (created once). */
export const ground = {
  get grass(): THREE.MeshLambertMaterial { return (_grass ??= texMat(grassTexture(), 14, 14)); },
  get soil(): THREE.MeshLambertMaterial { return (_soil ??= texMat(soilTexture(), 1, 1)); },
  get soilDry(): THREE.MeshLambertMaterial {
    if (!_soilDry) {
      _soilDry = texMat(soilTexture(), 1, 1);
      _soilDry.color.set(0xbb9a72);
    }
    return _soilDry;
  },
  get path(): THREE.MeshLambertMaterial { return (_path ??= texMat(pathTexture(), 2, 16)); },
  get wood(): THREE.MeshLambertMaterial { return (_wood ??= texMat(woodTexture(), 1, 1)); },
  get roof(): THREE.MeshLambertMaterial { return (_roof ??= texMat(roofTexture(), 3, 3)); },
  get barn(): THREE.MeshLambertMaterial { return (_barn ??= texMat(barnWallTexture(), 3, 2)); },
};

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
