import * as THREE from 'three';
import { box, cone, cyl, mat } from './materials';
import { Palette, BUILDINGS } from '../core/Config';
import type { Plot } from '../farming/farming';

// Crop visuals: sprout -> bush -> full + colored produce dots.
// Icon + scale convey state (never color-only); plot ring shows progress in main.ts via scale.
export function buildCropMesh(plot: Plot): THREE.Group {
  const g = new THREE.Group();
  if (plot.state === 'empty' || !plot.crop) return g;
  const stage = plot.state === 'planted' ? 0 : plot.state === 'growing' ? 1 : 2;
  const h = [0.4, 0.9, 1.4][stage];
  // stalk
  const stalk = cyl(0.08, 0.12, h, Palette.stalk);
  stalk.position.y = h / 2;
  g.add(stalk);
  if (plot.crop === 'maize') {
    const cob = cyl(0.16, 0.16, 0.5, Palette.maize);
    cob.position.y = h * 0.7;
    g.add(cob);
  } else if (plot.crop === 'tomato') {
    for (let i = 0; i < 2 + stage; i++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(Palette.tomato));
      t.position.set((i % 2 ? 0.25 : -0.25), h * (0.5 + i * 0.18), 0);
      t.castShadow = true;
      g.add(t);
    }
  } else {
    // carrot: leaves above, orange cone below soil line hint
    for (let i = 0; i < 3; i++) {
      const leaf = cone(0.12, 0.5, Palette.leaf, 5);
      leaf.position.set((i - 1) * 0.2, h + 0.15, 0);
      g.add(leaf);
    }
    if (stage === 2) {
      const root = cone(0.16, 0.4, Palette.carrot, 6);
      root.position.y = 0.25;
      root.rotation.x = Math.PI;
      g.add(root);
    }
  }
  return g;
}

export function buildBuildingMesh(defId: string): THREE.Group {
  const g = new THREE.Group();
  const def = BUILDINGS[defId];
  if (defId === 'barn') {
    const base = box(def.size[0], 2.5, def.size[1], Palette.barnRed);
    base.position.y = 1.25;
    g.add(base);
    const roof = cone(Math.max(def.size[0], def.size[1]) * 0.75, 1.6, Palette.roof, 4);
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (defId === 'shop') {
    const base = box(def.size[0], 2.6, def.size[1], Palette.cream);
    base.position.y = 1.3;
    g.add(base);
    const awning = box(def.size[0] + 0.6, 0.25, 1.4, Palette.barnRed);
    awning.position.set(0, 2.2, def.size[1] / 2 + 0.5);
    g.add(awning);
    const sign = box(2.4, 0.7, 0.15, Palette.wood);
    sign.position.set(0, 3, def.size[1] / 2);
    g.add(sign);
  } else if (defId === 'fence') {
    const p1 = box(0.18, 1, 0.18, Palette.wood);
    p1.position.set(-0.4, 0.5, 0);
    g.add(p1);
    const p2 = box(0.18, 1, 0.18, Palette.wood);
    p2.position.set(0.4, 0.5, 0);
    g.add(p2);
    const rail = box(1, 0.14, 0.1, Palette.wood);
    rail.position.y = 0.75;
    g.add(rail);
  } else {
    // path: flat slab
    const slab = box(def.size[0], 0.12, def.size[1], Palette.path);
    slab.position.y = 0.06;
    slab.castShadow = false;
    g.add(slab);
  }
  return g;
}
