import * as THREE from 'three';
import { box, cone, cyl, mat, std, ground } from './materials';
import { Palette, BUILDINGS } from '../core/Config';
import { awningTexture, signTexture } from './textures';
import type { Plot } from '../farming/farming';

// ---------- small part helpers ----------
function leafBlade(len: number, w: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, w), mat(color));
  m.castShadow = true;
  return m;
}

function blob(r: number, color: number, glossy = false): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 1),
    glossy ? std(color, 0.35) : mat(color),
  );
  m.castShadow = true;
  return m;
}

function fruitBall(r: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), std(color, 0.3));
  m.castShadow = true;
  return m;
}

/** Window with frame, glass and cross muntins. Faces +Z. */
function windowUnit(w: number, h: number, warm = false): THREE.Group {
  const g = new THREE.Group();
  const frame = box(w + 0.18, h + 0.18, 0.1, Palette.cream);
  g.add(frame);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.12),
    std(warm ? 0xffd98a : 0xbfd9e8, 0.15, 0.4),
  );
  g.add(glass);
  const muntV = box(0.06, h, 0.13, Palette.cream);
  g.add(muntV);
  const muntH = box(w, 0.06, 0.13, Palette.cream);
  g.add(muntH);
  return g;
}

/** Paneled door with frame. Faces +Z. */
function doorUnit(w: number, h: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = box(w + 0.24, h + 0.12, 0.12, Palette.wood);
  frame.position.y = 0.06;
  g.add(frame);
  const door = box(w, h, 0.14, color);
  door.position.y = 0.06;
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xd9a441, 0.3, 0.7));
  knob.position.set(w * 0.3, 0.1, 0.1);
  g.add(knob);
  return g;
}

// ---------- crops ----------
export function buildCropMesh(plot: Plot): THREE.Group {
  const g = new THREE.Group();
  if (plot.state === 'empty' || !plot.crop) return g;
  const stage = plot.state === 'planted' ? 0 : plot.state === 'growing' ? 1 : 2;
  const s = [0.45, 0.85, 1.25][stage]; // overall scale by stage

  if (plot.crop === 'maize') {
    const h = 1.5 * s + 0.25;
    const stalk = cyl(0.07, 0.11, h, Palette.stalk);
    stalk.position.y = h / 2;
    g.add(stalk);
    const nLeaves = 2 + stage * 2;
    for (let i = 0; i < nLeaves; i++) {
      const leaf = leafBlade(0.85 * s + 0.2, 0.16, i % 2 ? Palette.stalk : Palette.leaf);
      const a = (i / nLeaves) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.3, h * (0.35 + (i % 3) * 0.2), Math.sin(a) * 0.3);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.5; // droop
      g.add(leaf);
    }
    // tassel
    const tassel = cone(0.09, 0.3, 0x9c6b3f, 5);
    tassel.position.y = h + 0.12;
    g.add(tassel);
    if (stage === 2) {
      const cob = cyl(0.15, 0.15, 0.5, Palette.maize, 10);
      cob.position.set(0.16, h * 0.62, 0);
      (cob.material as THREE.Material) = std(Palette.maize, 0.5);
      g.add(cob);
      for (const sx of [-1, 1]) {
        const husk = leafBlade(0.4, 0.12, Palette.stalk);
        husk.position.set(0.16 + sx * 0.14, h * 0.5, 0);
        husk.rotation.z = sx * 0.9;
        g.add(husk);
      }
    }
  } else if (plot.crop === 'tomato') {
    const h = 1.2 * s + 0.2;
    // support stake + twine
    const stake = cyl(0.04, 0.05, h + 0.3, Palette.wood, 6);
    stake.position.set(-0.3, (h + 0.3) / 2, 0);
    g.add(stake);
    for (let i = 0; i < 2 + stage; i++) {
      const stem = cyl(0.03, 0.045, h * 0.8, Palette.stalk, 5);
      stem.position.set(-0.1 + i * 0.18, h * 0.4, (i % 2 ? 0.1 : -0.1));
      stem.rotation.z = (i - 1) * 0.25;
      g.add(stem);
    }
    const nLeaf = 3 + stage * 2;
    for (let i = 0; i < nLeaf; i++) {
      const b = blob(0.16 + stage * 0.03, i % 2 ? 0x2f7a33 : 0x3E9B4F);
      const a = (i / nLeaf) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.28, h * (0.4 + (i % 3) * 0.22), Math.sin(a) * 0.28);
      b.scale.y = 0.75;
      g.add(b);
    }
    const nFruit = stage === 2 ? 5 : stage === 1 ? 2 : 0;
    for (let i = 0; i < nFruit; i++) {
      const f = fruitBall(0.13, stage === 2 ? Palette.tomato : 0x7a9a3a);
      const a = (i / nFruit) * Math.PI * 2 + 0.4;
      f.position.set(Math.cos(a) * 0.3, h * (0.35 + (i % 2) * 0.3), Math.sin(a) * 0.3);
      g.add(f);
      const cap = cone(0.05, 0.08, Palette.leaf, 5);
      cap.position.set(f.position.x, f.position.y + 0.14, f.position.z);
      g.add(cap);
    }
  } else if (plot.crop === 'carrot') {
    // soil mound
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(Palette.soilDry));
    mound.scale.y = 0.4;
    mound.position.y = 0.1;
    mound.castShadow = true;
    mound.receiveShadow = true;
    g.add(mound);
    const nLeaf = 4 + stage * 2;
    for (let i = 0; i < nLeaf; i++) {
      const leaf = cone(0.07, (0.5 + stage * 0.25) * s + 0.3, i % 2 ? Palette.leaf : 0x3E9B4F, 5);
      const a = (i / nLeaf) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.15, 0.35 + stage * 0.15, Math.sin(a) * 0.15);
      leaf.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(leaf);
    }
    if (stage === 2) {
      const shoulder = cyl(0.14, 0.1, 0.22, Palette.carrot, 8);
      shoulder.position.y = 0.28;
      (shoulder.material as THREE.Material) = std(Palette.carrot, 0.5);
      g.add(shoulder);
    }
  } else if (plot.crop === 'wheat') {
    const n = 5 + stage;
    for (let i = 0; i < n; i++) {
      const h = (0.9 + (i % 3) * 0.15) * s + 0.2;
      const green = stage < 2;
      const stalk = cyl(0.025, 0.035, h, green ? Palette.stalk : 0xc9a24a, 5);
      const a = (i / n) * Math.PI * 2;
      stalk.position.set(Math.cos(a) * 0.22, h / 2, Math.sin(a) * 0.22);
      stalk.rotation.set(Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08);
      g.add(stalk);
      if (stage >= 1) {
        const head = box(0.09, 0.32, 0.09, green ? 0x7aa14f : 0xd9a441);
        head.position.set(stalk.position.x, h + 0.1, stalk.position.z);
        head.rotation.copy(stalk.rotation);
        g.add(head);
      }
    }
  } else {
    // pumpkin: sprawling vine + lobed leaves + fruit
    const vine = cyl(0.05, 0.06, 1.6 * s + 0.4, Palette.stalk, 6);
    vine.rotation.z = Math.PI / 2;
    vine.position.y = 0.08;
    g.add(vine);
    for (let i = 0; i < 3; i++) {
      const leaf = blob(0.22 * s + 0.1, 0x2f7a33);
      leaf.scale.y = 0.45;
      leaf.position.set(-0.5 * s + i * 0.5 * s, 0.22, (i % 2 ? 0.25 : -0.25));
      g.add(leaf);
    }
    if (stage >= 1) {
      const r = stage === 2 ? 0.34 : 0.16;
      const p = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), std(stage === 2 ? Palette.carrot : 0x6fa04a, 0.45));
      p.scale.y = 0.8;
      p.position.y = r * 0.8;
      p.castShadow = true;
      g.add(p);
      // ribs
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(r * 0.99, 0.02, 6, 12, Math.PI),
          std(0xb25a1a, 0.6),
        );
        rib.rotation.y = (i / 6) * Math.PI;
        rib.rotation.z = 0;
        rib.position.y = r * 0.8;
        rib.scale.y = 0.8;
        g.add(rib);
      }
      const stem = cyl(0.05, 0.07, 0.22, 0x5a7a2a, 6);
      stem.position.y = r * 0.8 + r * 0.75;
      stem.rotation.z = 0.2;
      g.add(stem);
    }
  }
  return g;
}

// ---------- buildings ----------
function stoneFoundation(w: number, h: number, d: number): THREE.Mesh {
  const f = box(w + 0.4, 0.5, d + 0.4, 0x8d8d94);
  f.position.y = 0.25;
  return f;
}

function chimney(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const stack = box(0.6, 1.6, 0.6, 0x9a5a4a);
  stack.position.y = 0.8;
  g.add(stack);
  const cap = box(0.9, 0.2, 0.9, 0x5a5a60);
  cap.position.y = 1.7;
  g.add(cap);
  g.position.set(x, y, z);
  return g;
}

export function buildBuildingMesh(defId: string): THREE.Group {
  const g = new THREE.Group();
  const def = BUILDINGS[defId];
  const [w, d] = def.size;

  if (defId === 'barn') {
    g.add(stoneFoundation(w, 0.5, d));
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), ground.barn);
    walls.position.y = 1.75;
    walls.castShadow = walls.receiveShadow = true;
    g.add(walls);
    // gambrel roof: two steep + two shallow slabs
    const roofM = ground.roof;
    for (const sx of [-1, 1]) {
      const low = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, d + 0.8), roofM);
      low.position.set(sx * (w / 2 - 0.4), 3.6, 0);
      low.rotation.z = sx * 0.5;
      low.castShadow = true;
      g.add(low);
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, d + 0.8), roofM);
      up.position.set(sx * (w / 2 - 1.9), 4.9, 0);
      up.rotation.z = sx * 1.05;
      up.castShadow = true;
      g.add(up);
    }
    const ridge = box(0.5, 0.25, d + 0.8, Palette.roof);
    ridge.position.y = 5.6;
    g.add(ridge);
    // sliding door with X brace
    const door = box(2.2, 2.2, 0.15, 0x7a3a36);
    door.position.set(0, 1.6, d / 2 + 0.05);
    g.add(door);
    for (const r of [0.7, -0.7]) {
      const brace = box(0.18, 2.9, 0.17, Palette.cream);
      brace.position.set(0, 1.6, d / 2 + 0.06);
      brace.rotation.z = r;
      g.add(brace);
    }
    // hayloft round window
    const loft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.16, 12), mat(Palette.cream));
    loft.rotation.x = Math.PI / 2;
    loft.position.set(0, 3.9, d / 2 + 0.02);
    g.add(loft);
    const loftGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12), std(0xbfd9e8, 0.2, 0.3));
    loftGlass.rotation.x = Math.PI / 2;
    loftGlass.position.set(0, 3.9, d / 2 + 0.02);
    g.add(loftGlass);
    const win = windowUnit(0.8, 0.8);
    win.position.set(-w / 2 + 0.6, 1.9, d / 2 + 0.05);
    g.add(win);
  } else if (defId === 'shop') {
    g.add(stoneFoundation(w, 0.4, d));
    const walls = box(w, 2.6, d, Palette.cream);
    walls.position.y = 1.8;
    g.add(walls);
    // storefront: glass + goods
    for (const sx of [-1.4, 1.4]) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.1), std(0xbfd9e8, 0.1, 0.5));
      glass.position.set(sx, 1.7, d / 2 + 0.04);
      g.add(glass);
      const frame = box(2.2, 1.4, 0.06, Palette.wood);
      frame.position.set(sx, 1.7, d / 2);
      g.add(frame);
      for (let i = 0; i < 3; i++) {
        const goods = box(0.4, 0.4, 0.3, [Palette.maize, Palette.tomato, Palette.carrot][i]);
        goods.position.set(sx - 0.5 + i * 0.5, 1.35, d / 2 + 0.12);
        g.add(goods);
      }
    }
    const door = doorUnit(1.1, 2.0, Palette.wood);
    door.position.set(0, 0.5, d / 2 + 0.05);
    g.add(door);
    // striped awning
    const awnTex = awningTexture();
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.8, 0.12, 1.8),
      new THREE.MeshLambertMaterial({ map: awnTex }),
    );
    awn.position.set(0, 2.9, d / 2 + 0.8);
    awn.rotation.x = 0.25;
    awn.castShadow = true;
    g.add(awn);
    // sign
    const signTex = signTexture('FARM SHOP');
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.85, 0.15),
      new THREE.MeshLambertMaterial({ map: signTex }),
    );
    sign.position.set(0, 3.5, d / 2 + 0.1);
    sign.castShadow = true;
    g.add(sign);
    const roof = box(w + 0.6, 0.3, d + 0.6, Palette.roof);
    roof.position.y = 3.4;
    g.add(roof);
  } else if (defId === 'warehouse') {
    g.add(stoneFoundation(w, 0.5, d));
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), ground.wood);
    walls.position.y = 2;
    walls.castShadow = walls.receiveShadow = true;
    g.add(walls);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.25, d + 0.8), ground.roof);
    roof.position.y = 3.6;
    roof.castShadow = true;
    g.add(roof);
    const door = box(2.4, 2.4, 0.15, 0x5a4632);
    door.position.set(0, 1.7, d / 2 + 0.05);
    g.add(door);
    for (const sx of [-2, 2]) {
      const win = windowUnit(0.7, 0.7);
      win.position.set(sx, 2.4, d / 2 + 0.05);
      g.add(win);
    }
  } else if (defId === 'quarters') {
    g.add(stoneFoundation(w, 0.4, d));
    const walls = box(w, 2.4, d, Palette.cream);
    walls.position.y = 1.7;
    g.add(walls);
    const roof = cone(Math.max(w, d) * 0.72, 1.5, Palette.barnRed, 4);
    roof.position.y = 3.6;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(chimney(w / 2 - 0.8, 3.4, -d / 4));
    const win1 = windowUnit(0.9, 0.9, true);
    win1.position.set(-1.3, 1.8, d / 2 + 0.05);
    g.add(win1);
    const win2 = windowUnit(0.9, 0.9, true);
    win2.position.set(1.3, 1.8, d / 2 + 0.05);
    g.add(win2);
    const door = doorUnit(1.0, 1.9, Palette.wood);
    door.position.set(0, 0.5, d / 2 + 0.05);
    g.add(door);
  } else if (defId === 'coop') {
    const walls = box(w, 1.4, d, Palette.barnRed);
    walls.position.y = 0.7;
    g.add(walls);
    const roof = cone(3, 1.2, Palette.roof, 4);
    roof.position.y = 2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    // wire run
    const runMat = new THREE.MeshLambertMaterial({ color: 0xdddddd, transparent: true, opacity: 0.3 });
    for (const [px, pz, ww, dd] of [[0, d / 2 + 1.5, w, 0.1], [-w / 2, d / 2 + 1.5, 0.1, 3], [w / 2, d / 2 + 1.5, 0.1, 3]] as Array<[number, number, number, number]>) {
      const post = box(0.12, 1.2, 0.12, Palette.wood);
      post.position.set(px * 0.9, 0.6, pz);
      g.add(post);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(ww || 0.05, 1.0, dd || 0.05), runMat);
      mesh.position.set(px, 0.6, pz);
      g.add(mesh);
    }
    // ramp + egg
    const ramp = box(1.0, 0.12, 1.8, Palette.wood);
    ramp.position.set(0, 0.3, d / 2 + 0.9);
    ramp.rotation.x = -0.35;
    g.add(ramp);
    const egg = fruitBall(0.16, Palette.cream);
    egg.scale.y = 1.3;
    egg.position.set(1.2, 0.2, 1.2);
    g.add(egg);
    const win = windowUnit(0.6, 0.6);
    win.position.set(0, 0.9, d / 2 + 0.05);
    g.add(win);
  } else if (defId === 'garage') {
    const floor = box(w, 0.15, d, 0x6a6a70);
    floor.position.y = 0.08;
    g.add(floor);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, 0.3), ground.wood);
    back.position.set(0, 1.3, -d / 2);
    back.castShadow = true;
    g.add(back);
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, d), ground.wood);
      wall.position.set((sx * w) / 2, 1.3, 0);
      wall.castShadow = true;
      g.add(wall);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.25, d + 0.5), ground.roof);
    roof.position.y = 2.75;
    roof.castShadow = true;
    g.add(roof);
    // tire stack + tool board + bench
    for (let i = 0; i < 2; i++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), mat(0x2b2b2b));
      tire.position.set(-w / 2 + 0.8, 0.3 + i * 0.32, -d / 2 + 0.8);
      tire.castShadow = true;
      g.add(tire);
    }
    const board = box(1.6, 1.0, 0.1, 0x7a3a36);
    board.position.set(w / 2 - 0.2, 1.5, -d / 2 + 0.2);
    g.add(board);
    const bench = box(1.8, 0.5, 0.7, Palette.wood);
    bench.position.set(1, 0.4, -d / 2 + 0.9);
    g.add(bench);
  } else if (defId === 'fence') {
    for (const sx of [-0.4, 0.4]) {
      const post = box(0.18, 1.1, 0.18, Palette.wood);
      post.position.set(sx, 0.55, 0);
      g.add(post);
      const cap = box(0.26, 0.1, 0.26, Palette.roof);
      cap.position.set(sx, 1.15, 0);
      g.add(cap);
    }
    for (const ry of [0.55, 0.9]) {
      const rail = box(1.0, 0.12, 0.08, Palette.wood);
      rail.position.y = ry;
      g.add(rail);
    }
  } else {
    // path: textured slab with stone edging
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), ground.path);
    slab.position.y = 0.06;
    slab.receiveShadow = true;
    g.add(slab);
  }
  return g;
}

// ---------- tractor ----------
export function buildTractorMesh(): THREE.Group {
  const g = new THREE.Group();
  const paint = std(0xb03a30, 0.4, 0.2);
  const darkPaint = std(0x7a2822, 0.5, 0.2);
  // chassis + hood
  const chassis = box(1.1, 0.35, 2.8, 0x2b2b2b);
  chassis.position.y = 0.55;
  (chassis.material as THREE.Material) = mat(0x2b2b2b);
  g.add(chassis);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.4), paint);
  hood.position.set(0, 1.05, 0.7);
  hood.castShadow = true;
  g.add(hood);
  const grille = box(0.9, 0.55, 0.1, 0x222226);
  grille.position.set(0, 1.0, 1.42);
  g.add(grille);
  for (const sx of [-0.32, 0.32]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), std(0xfff2b0, 0.2, 0.1));
    lamp.position.set(sx, 1.25, 1.44);
    g.add(lamp);
  }
  // exhaust
  const pipe = cyl(0.07, 0.07, 0.9, 0x1c1c1e, 8);
  pipe.position.set(0.35, 1.7, 0.9);
  g.add(pipe);
  const pipeCap = cyl(0.1, 0.07, 0.1, 0x1c1c1e, 8);
  pipeCap.position.set(0.35, 2.15, 0.9);
  g.add(pipeCap);
  // fenders over rear wheels
  for (const sx of [-0.95, 0.95]) {
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.1), darkPaint);
    fender.position.set(sx, 1.15, -0.85);
    fender.castShadow = true;
    g.add(fender);
  }
  // seat + steering
  const seat = box(0.55, 0.5, 0.5, 0x2b2b2b);
  seat.position.set(0, 1.15, -0.55);
  g.add(seat);
  const column = cyl(0.04, 0.04, 0.6, 0x444448, 6);
  column.position.set(0, 1.3, 0.05);
  column.rotation.x = 0.5;
  g.add(column);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 14), mat(0x222226));
  wheel.position.set(0, 1.55, 0.18);
  wheel.rotation.x = -0.9;
  g.add(wheel);
  // wheels with hubs
  const wheelG = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 14);
  wheelG.rotateZ(Math.PI / 2);
  const smallG = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 12);
  smallG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.14, 0.14, 0.37, 10);
  hubG.rotateZ(Math.PI / 2);
  const tireM = mat(0x232326);
  const hubM = std(0xc9a24a, 0.4, 0.5);
  for (const [geo, x, y, z] of [[wheelG, -0.95, 0.55, -0.85], [wheelG, 0.95, 0.55, -0.85], [smallG, -0.85, 0.42, 0.95], [smallG, 0.85, 0.42, 0.95]] as Array<[THREE.BufferGeometry, number, number, number]>) {
    const wh = new THREE.Mesh(geo, tireM);
    wh.position.set(x, y, z);
    wh.castShadow = true;
    g.add(wh);
    const hub = new THREE.Mesh(hubG, hubM);
    hub.position.set(x, y, z);
    g.add(hub);
  }
  // cultivator bar
  const bar = box(2.0, 0.15, 0.3, Palette.wood);
  bar.position.set(0, 0.4, -1.7);
  g.add(bar);
  for (const sx of [-0.7, 0, 0.7]) {
    const tine = cyl(0.03, 0.02, 0.4, 0x55555a, 5);
    tine.position.set(sx, 0.2, -1.7);
    g.add(tine);
  }
  return g;
}

export type CustomerVehicleKind = 'car' | 'van' | 'pickup';

// Customer vehicles: glossy body, glasshouse, lights, bumpers.
export function buildCustomerVehicleMesh(kind: CustomerVehicleKind): THREE.Group {
  const colors = { car: 0x5b8dd9, van: 0x66bb6a, pickup: 0xef9e3a } as const;
  const sizes = { car: [1.6, 0.65, 3.0], van: [1.8, 1.15, 3.6], pickup: [1.7, 0.75, 3.4] } as const;
  const [wid, hei, len] = sizes[kind];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, hei, len), std(colors[kind], 0.35, 0.25));
  body.position.y = 0.55 + hei / 2;
  body.castShadow = true;
  g.add(body);
  // glasshouse
  const cabLen = kind === 'van' ? len * 0.55 : len * 0.4;
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(wid * 0.86, 0.5, cabLen),
    std(0x9fc4d8, 0.1, 0.5),
  );
  glass.position.set(0, 0.55 + hei + 0.28, kind === 'van' ? 0.2 : -len * 0.05);
  glass.castShadow = true;
  g.add(glass);
  const roofP = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.08, cabLen + 0.1), std(colors[kind], 0.4, 0.2));
  roofP.position.set(glass.position.x, glass.position.y + 0.3, glass.position.z);
  g.add(roofP);
  if (kind === 'pickup') {
    // open bed: dark floor + inner walls
    const bed = box(wid * 0.9, 0.1, len * 0.32, 0x2b2b2b);
    bed.position.set(0, 0.55 + hei + 0.02, len * 0.28);
    g.add(bed);
  }
  // bumpers + lights
  for (const sz of [1, -1]) {
    const bumper = box(wid + 0.1, 0.18, 0.15, 0x55555a);
    bumper.position.set(0, 0.45, sz * (len / 2 + 0.02));
    g.add(bumper);
  }
  for (const sx of [-wid / 3, wid / 3]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(0xfff2b0, 0.2, 0.1));
    head.position.set(sx, 0.75, len / 2 + 0.05);
    g.add(head);
    const tail = box(0.16, 0.12, 0.06, 0xc0392b);
    tail.position.set(sx, 0.75, -len / 2 - 0.03);
    g.add(tail);
  }
  const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12);
  wheelG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8);
  hubG.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-wid / 2, len / 3], [wid / 2, len / 3], [-wid / 2, -len / 3], [wid / 2, -len / 3]] as Array<[number, number]>) {
    const wh = new THREE.Mesh(wheelG, mat(0x232326));
    wh.position.set(x, 0.34, z);
    wh.castShadow = true;
    g.add(wh);
    const hub = new THREE.Mesh(hubG, std(0x999aa0, 0.35, 0.6));
    hub.position.set(x, 0.34, z);
    g.add(hub);
  }
  return g;
}

// Staffer: overalls body, arms, head with straw hat.
export function buildStaffMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-0.13, 0.13]) {
    const leg = cyl(0.09, 0.1, 0.45, 0x3a3a40, 6);
    leg.position.set(sx, 0.22, 0);
    g.add(leg);
  }
  const body = cyl(0.3, 0.38, 0.75, color, 10);
  body.position.y = 0.8;
  (body.material as THREE.Material) = std(color, 0.7);
  g.add(body);
  // straps
  for (const sx of [-0.12, 0.12]) {
    const strap = box(0.09, 0.4, 0.05, 0xd9c07a);
    strap.position.set(sx, 1.0, 0.3);
    g.add(strap);
  }
  for (const sx of [-0.4, 0.4]) {
    const arm = cyl(0.08, 0.07, 0.55, color, 6);
    arm.position.set(sx, 0.85, 0);
    arm.rotation.z = sx * 0.25;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), std(0xf1c27d, 0.6));
  head.position.y = 1.42;
  head.castShadow = true;
  g.add(head);
  const brim = cyl(0.42, 0.42, 0.05, 0xd9c07a, 12);
  brim.position.y = 1.58;
  g.add(brim);
  const top = cyl(0.2, 0.24, 0.2, 0xc9a959, 10);
  top.position.y = 1.7;
  g.add(top);
  return g;
}
