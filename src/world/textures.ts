import * as THREE from 'three';

// Procedural canvas textures — runtime-generated, zero external assets.
// All textures tile; colorSpace set for correct lighting.

function makeTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, s: number, n: number, colors: string[], rMin: number, rMax: number): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function grassTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7EC850';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 900, ['#6db844', '#8fd45e', '#5DA93C', '#a4e07a'], 1, 3);
    // blades
    ctx.strokeStyle = '#4e8f33';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 4);
      ctx.stroke();
    }
  });
}

export function soilTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#8A5A33';
    ctx.fillRect(0, 0, s, s);
    // furrow rows
    for (let y = 0; y < s; y += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, s, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, y + 7, s, 4);
    }
    speckle(ctx, s, 500, ['#6E4426', '#9c6b3f', '#5a3a20'], 1, 2.5);
  });
}

export function pathTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#D9B382';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 700, ['#c9a173', '#e8c795', '#b08d5e'], 1, 3);
  });
}

export function woodTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#A67C52';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, 0, 3, s);
      ctx.strokeStyle = 'rgba(90,60,30,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.bezierCurveTo(x + 12, y + 6, x + 20, y - 6, x + 30, y + 4);
        ctx.stroke();
      }
    }
  });
}

export function roofTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7A4A3A';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 24) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y, s, 3);
      for (let x = ((y / 24) % 2) * 16; x < s; x += 32) {
        ctx.fillRect(x, y, 3, 24);
      }
    }
    speckle(ctx, s, 200, ['#8a5a44', '#6b4030'], 1, 2);
  });
}

export function awningTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    for (let x = 0; x < s; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? '#C94F4F' : '#FFF6E9';
      ctx.fillRect(x, 0, 32, s);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, s - 20, s, 20);
  });
}

export function barnWallTexture(): THREE.CanvasTexture {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#B85450';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 22) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, 0, 3, s);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + 3, 0, 4, s);
    }
  });
}

export function signTexture(text: string, bg = '#5d3f28', fg = '#FFE9B8'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#3a2812';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = fg;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
