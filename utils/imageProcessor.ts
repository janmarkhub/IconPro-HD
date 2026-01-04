
import { BatchEffects } from '../types';

export const DEFAULT_EFFECTS: BatchEffects = {
  outlineEnabled: false,
  glowEnabled: false,
  cleanupEnabled: true,
  outlineWidth: 5,
  outlineColor: '#ffffff',
  outlineOpacity: 1,
  outlineStyle: 'solid',
  glowBlur: 15,
  glowColor: '#00ff00',
  glowOpacity: 0.6,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  shadowBlur: 10,
  shadowColor: '#000000',
  shadowOpacity: 0.3,
  isPixelArt: false,
  autoFit: true,
  customStickers: [],
  removeBackground: true, 
  scrubAggression: 80,
  keepInternalColors: true,
  cleanupIntensity: 50
};

export function calculateFidelity(img: HTMLImageElement): number {
    const area = img.width * img.height;
    return Math.min(100, Math.sqrt(area) / 1024 * 100);
}

function applySmartCleanup(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
    if (intensity <= 0) return;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const out = new Uint8ClampedArray(data);
    const radius = 1;
    const sigmaColor = 5 + (intensity * 0.45);
    
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const i = (y * width + x) * 4;
            if (data[i+3] === 0) continue;
            
            let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
            const rRef = data[i], gRef = data[i+1], bRef = data[i+2];

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const ni = ((y + dy) * width + (x + dx)) * 4;
                    const nR = data[ni], nG = data[ni+1], nB = data[ni+2], nA = data[ni+3];
                    if (nA === 0) continue;
                    
                    const colorDist = Math.sqrt(Math.pow(nR-rRef,2) + Math.pow(nG-gRef,2) + Math.pow(nB-bRef,2));
                    const weight = Math.exp(-colorDist / sigmaColor);
                    
                    rSum += nR * weight;
                    gSum += nG * weight;
                    bSum += nB * weight;
                    wSum += weight;
                }
            }
            if (wSum > 0) {
                out[i] = rSum / wSum;
                out[i+1] = gSum / wSum;
                out[i+2] = bSum / wSum;
            }
        }
    }
    ctx.putImageData(new ImageData(out, width, height), 0, 0);
}

export async function removeBgAndCenter(img: HTMLImageElement, aggression: number = 80, keepInternal: boolean = true): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const samples = [
        [0,0], [canvas.width-1, 0], [0, canvas.height-1], [canvas.width-1, canvas.height-1]
    ];
    let avgR=0, avgG=0, avgB=0;
    samples.forEach(([x,y]) => {
        const i = (y * canvas.width + x) * 4;
        avgR += data[i]; avgG += data[i+1]; avgB += data[i+2];
    });
    const bgR = avgR / 4, bgG = avgG / 4, bgB = avgB / 4;

    const tolerance = aggression + 15;
    const visited = new Uint8Array(canvas.width * canvas.height);
    const queue: [number, number][] = [];

    // Flood fill only if we want to keep internal colors
    if (keepInternal) {
        for (let x = 0; x < canvas.width; x++) { queue.push([x, 0]); queue.push([x, canvas.height - 1]); }
        for (let y = 0; y < canvas.height; y++) { queue.push([0, y]); queue.push([canvas.width - 1, y]); }

        while (queue.length > 0) {
            const [x, y] = queue.pop()!;
            const idx = y * canvas.width + x;
            if (visited[idx]) continue;

            const i = idx * 4;
            const dist = Math.sqrt(Math.pow(data[i]-bgR,2) + Math.pow(data[i+1]-bgG,2) + Math.pow(data[i+2]-bgB,2));
            
            if (dist < tolerance) {
                visited[idx] = 1;
                data[i+3] = 0;
                if (x > 0) queue.push([x - 1, y]);
                if (x < canvas.width - 1) queue.push([x + 1, y]);
                if (y > 0) queue.push([x, y - 1]);
                if (y < canvas.height - 1) queue.push([x, y + 1]);
            }
        }
    } else {
        // Global removal (wipe all matching colors regardless of connectivity)
        for (let i = 0; i < data.length; i += 4) {
            const dist = Math.sqrt(Math.pow(data[i]-bgR,2) + Math.pow(data[i+1]-bgG,2) + Math.pow(data[i+2]-bgB,2));
            if (dist < tolerance) data[i+3] = 0;
        }
    }

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let hasContent = false;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 0) {
            const x = (i/4) % canvas.width;
            const y = Math.floor((i/4) / canvas.width);
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            hasContent = true;
        }
    }

    if (!hasContent) return new Promise((res) => canvas.toBlob(b => res(b!), 'image/png'));

    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;
    const final = document.createElement('canvas');
    final.width = 1024;
    final.height = 1024;
    const fctx = final.getContext('2d')!;
    fctx.imageSmoothingEnabled = false;

    const scale = Math.min(960 / contentW, 960 / contentH);
    const dw = contentW * scale, dh = contentH * scale;
    const dx = (1024 - dw) / 2, dy = (1024 - dh) / 2;

    const temp = document.createElement('canvas');
    temp.width = img.width; temp.height = img.height;
    temp.getContext('2d')!.putImageData(imageData, 0, 0);

    fctx.drawImage(temp, minX, minY, contentW, contentH, dx, dy, dw, dh);
    return new Promise((res) => final.toBlob(b => res(b!), 'image/png'));
}

export async function upscaleAndEditImage(
  source: HTMLImageElement | Blob, 
  targetSize: number, 
  effects: BatchEffects,
  cropBox?: [number, number, number, number],
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    let img: HTMLImageElement;
    if (source instanceof Blob) {
      img = new Image();
      img.src = URL.createObjectURL(source);
      await new Promise(r => img.onload = r);
    } else img = source;

    const canvas = document.createElement('canvas');
    canvas.width = targetSize; canvas.height = targetSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    ctx.imageSmoothingEnabled = !effects.isPixelArt;
    if (effects.isPixelArt) {
        canvas.style.imageRendering = 'pixelated';
    }

    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (cropBox) {
        sy = (cropBox[0] / 1000) * img.height; sx = (cropBox[1] / 1000) * img.width;
        sh = ((cropBox[2] - cropBox[0]) / 1000) * img.height; sw = ((cropBox[3] - cropBox[1]) / 1000) * img.width;
    }

    let margin = targetSize * 0.12;
    if (effects.autoFit) {
      const extra = Math.max(
          effects.outlineEnabled ? effects.outlineWidth : 0, 
          effects.glowEnabled ? effects.glowBlur : 0
      );
      margin += extra * (targetSize / 512);
    }

    const drawSize = targetSize - margin * 2;
    const scale = Math.min(drawSize / sw, drawSize / sh);
    const dw = sw * scale, dh = sh * scale;
    const dx = (targetSize - dw) / 2, dy = (targetSize - dh) / 2;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = targetSize; mCanvas.height = targetSize;
    const mctx = mCanvas.getContext('2d', { willReadFrequently: true })!;
    mctx.imageSmoothingEnabled = !effects.isPixelArt;
    mctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

    if (effects.removeBackground) {
        const mData = mctx.getImageData(0,0,targetSize,targetSize);
        const d = mData.data;
        const bgR = d[0], bgG = d[1], bgB = d[2];
        const tol = effects.scrubAggression + 15;
        
        for (let i=0; i<d.length; i+=4) {
            const dist = Math.sqrt(Math.pow(d[i]-bgR,2) + Math.pow(d[i+1]-bgG,2) + Math.pow(d[i+2]-bgB,2));
            if (dist < tol) d[i+3] = 0;
        }
        mctx.putImageData(mData, 0, 0);
    }

    if (effects.cleanupEnabled) {
        applySmartCleanup(mctx, targetSize, targetSize, effects.cleanupIntensity);
    }

    ctx.save();
    if (effects.glowEnabled) {
        ctx.shadowBlur = effects.glowBlur * (targetSize / 512);
        ctx.shadowColor = effects.glowColor;
        ctx.globalAlpha = effects.glowOpacity;
        for(let i=0; i<3; i++) ctx.drawImage(mCanvas, 0, 0);
    }
    ctx.restore();

    if (effects.outlineEnabled) {
        ctx.save();
        const thickness = effects.outlineWidth * (targetSize / 512);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = effects.outlineColor;
        ctx.globalAlpha = effects.outlineOpacity;
        for(let i=0; i<360; i += 20) {
            let a = (i * Math.PI) / 180;
            ctx.drawImage(mCanvas, Math.cos(a)*thickness, Math.sin(a)*thickness);
        }
        ctx.restore();
    }

    ctx.save();
    ctx.filter = `brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturation}%) hue-rotate(${effects.hueRotate}deg)`;
    ctx.drawImage(mCanvas, 0, 0);
    ctx.restore();

    canvas.toBlob(b => b ? resolve(b) : reject('Blob error'), 'image/png');
  });
}
