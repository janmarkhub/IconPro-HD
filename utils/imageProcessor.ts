
import { CustomSticker, BatchEffects, StickerTexture } from '../types';

export const DEFAULT_EFFECTS: BatchEffects = {
  outlineWidth: 0,
  outlineColor: '#ffffff',
  outlineOpacity: 1,
  outlineStyle: 'solid',
  outlineNoise: 0,
  waveAmplitude: 5,
  waveFrequency: 10,
  dashPattern: [10, 5],
  glowBlur: 0,
  glowColor: '#4f46e5',
  glowOpacity: 0.5,
  glowNoise: 0,
  innerGlowBlur: 0,
  innerGlowColor: '#ffffff',
  innerGlowOpacity: 0.5,
  bevelSize: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  shadowX: 0,
  shadowY: 4,
  shadowBlur: 10,
  shadowColor: '#000000',
  shadowOpacity: 0.3,
  cornerRadius: 0,
  sharpness: 0,
  edgeClamping: 0,
  isPixelArt: false,
  pixelDepth: 'none',
  autoFit: true,
  activeStickers: [],
  customStickers: [],
  rgbCycle: false,
  rgbSplit: 0,
  tvNoise: 0,
  pixelSort: 0,
  fisheye: 0,
  duotone: false,
  duotoneColor1: '#000000',
  duotoneColor2: '#ffffff',
  dither: false,
  scanlines: 0,
  chromaticAberration: 0,
  sheenIntensity: 0,
  sheenAngle: 45,
  sparkleIntensity: 0,
  halftoneIntensity: 0,
  stickerMode: false,
  metallicIntensity: 0,
  vignette: 0,
  longShadowLength: 0,
  longShadowOpacity: 0.3,
  glassBlur: 0,
  glassOpacity: 0,
  finishType: 'none',
  finishOpacity: 0.8,
  removeBackground: false,
  normalizeInputs: true,
  smartUpscaleIntensity: 50,
  isAnimated: false,
  animationType: 'float',
  animationSpeed: 5,
  animationIntensity: 20,
  animationFrameCount: 12,
  animationFrameMode: 'linear',
  animationVicinityRange: 10,
  asciiMode: false,
  enchantmentGlint: false,
  crtEffect: false,
  creeperOverlay: false,
  sepiaTone: 0,
  blurIntensity: 0
};

export function calculateFidelity(img: HTMLImageElement): number {
    const area = img.width * img.height;
    return Math.min(100, Math.sqrt(area) / 1024 * 100);
}

export async function removeBgAndCenter(img: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Threshold for "near white". AI generated white is often #FEFEFE or similar.
    const t = 248; 
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let hasContent = false;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            
            // Content check: not transparent AND (not near-white)
            const isWhite = r >= t && g >= t && b >= t;
            if (a > 20 && !isWhite) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                hasContent = true;
            } else {
                data[i+3] = 0; // Scrub to alpha
            }
        }
    }

    if (!hasContent) return new Promise((res) => canvas.toBlob(b => res(b!), 'image/png'));

    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;
    
    // Ignore noise fragments
    if (contentW < 5 || contentH < 5) return new Promise((res) => canvas.toBlob(b => res(b!), 'image/png'));

    const final = document.createElement('canvas');
    const size = 1024; // Force high res for processed icons
    final.width = size;
    final.height = size;
    const fctx = final.getContext('2d')!;

    const drawArea = size * 0.75; // Leave breathing room
    const scale = Math.min(drawArea / contentW, drawArea / contentH);
    
    const dw = contentW * scale;
    const dh = contentH * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    const temp = document.createElement('canvas');
    temp.width = img.width; temp.height = img.height;
    temp.getContext('2d')!.putImageData(imageData, 0, 0);

    fctx.clearRect(0, 0, size, size);
    fctx.drawImage(temp, minX, minY, contentW, contentH, dx, dy, dw, dh);

    return new Promise((res) => final.toBlob(b => res(b!), 'image/png'));
}

export async function upscaleAndEditImage(
  source: HTMLImageElement | Blob, 
  targetSize: number, 
  effects: BatchEffects,
  cropBox?: [number, number, number, number],
  fidelityFactor: number = 100
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    let img: HTMLImageElement;
    if (source instanceof Blob) {
      img = new Image();
      const url = URL.createObjectURL(source);
      await new Promise((res) => { img.onload = res; img.src = url; });
      URL.revokeObjectURL(url);
    } else { img = source; }

    const canvas = document.createElement('canvas');
    canvas.width = targetSize; canvas.height = targetSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (cropBox) {
      sy = (cropBox[0] / 1000) * img.height; sx = (cropBox[1] / 1000) * img.width;
      sh = ((cropBox[2] - cropBox[0]) / 1000) * img.height; sw = ((cropBox[3] - cropBox[1]) / 1000) * img.width;
    }

    const padding = targetSize * 0.12;
    const drawSize = targetSize - padding * 2;
    const scaleFactor = Math.min(drawSize / sw, drawSize / sh);
    
    let animScale = 1;
    let animRotate = 0;
    let animXOffset = (targetSize - sw * scaleFactor) / 2;
    let animYOffset = (targetSize - sh * scaleFactor) / 2;

    if (effects.isAnimated) {
      const time = Date.now() / 1000;
      const speed = effects.animationSpeed;
      const intensity = effects.animationIntensity / 100;
      if (effects.animationType === 'float') animYOffset += Math.sin(time * speed) * 20 * intensity;
      else if (effects.animationType === 'pulse') animScale += Math.sin(time * speed) * 0.2 * intensity;
      else if (effects.animationType === 'spin') animRotate = time * speed * 30 * intensity;
    }

    const dw = sw * scaleFactor * animScale;
    const dh = sh * scaleFactor * animScale;
    const dx = (targetSize - dw) / 2;
    const dy = (targetSize - dh) / 2;

    ctx.imageSmoothingEnabled = fidelityFactor > 20 && effects.pixelDepth === 'none'; 

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = targetSize; maskCanvas.height = targetSize;
    const mctx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
    
    mctx.save();
    mctx.translate(targetSize/2, targetSize/2);
    mctx.rotate(animRotate * Math.PI / 180);
    mctx.translate(-targetSize/2, -targetSize/2);
    if (effects.cornerRadius > 0) {
        mctx.beginPath(); mctx.roundRect(dx, dy, dw, dh, (effects.cornerRadius/100)*(dw/2)); mctx.clip();
    }
    mctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    mctx.restore();

    if (effects.removeBackground) {
        const mData = mctx.getImageData(0,0,targetSize,targetSize);
        const d = mData.data;
        const t = 245; 
        for (let i=0; i<d.length; i+=4) {
            if (d[i] > t && d[i+1] > t && d[i+2] > t) d[i+3] = 0;
        }
        mctx.putImageData(mData, 0, 0);
    }

    ctx.save();
    let filterStr = `brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturation}%) hue-rotate(${effects.hueRotate}deg)`;
    ctx.filter = filterStr;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();

    if (effects.outlineWidth > 0) {
        ctx.save();
        const thickness = effects.outlineWidth * (targetSize / 512);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = effects.outlineColor;
        ctx.globalAlpha = effects.outlineOpacity;
        for(let i=0; i<360; i += 15) {
            let a = (i * Math.PI) / 180;
            ctx.drawImage(maskCanvas, Math.cos(a)*thickness, Math.sin(a)*thickness);
        }
        ctx.restore();
    }

    canvas.toBlob((b) => b ? resolve(b) : reject('Blob failed'), 'image/png');
  });
}
