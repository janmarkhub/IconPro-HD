
export interface ProcessedFile {
  id: string;
  originalName: string;
  newName: string;
  blob: Blob;
  previewUrl: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  width: number;
  height: number;
  isAiGenerated?: boolean;
  originalType: string;
  fidelityScore: number; 
}

export enum Resolution {
  SD = 256,
  HD = 512,
  FHD = 1024,
  UHD = 2048
}

export enum ExportFormat {
  ICO = 'ico',
  PNG = 'png',
  BMP = 'bmp',
  GIF = 'gif'
}

export type StickerTexture = 'none' | 'foil' | 'realistic' | 'holo' | 'gold' | 'silver';

export interface CustomSticker {
  id: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  texture: StickerTexture;
}

export interface Slice {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BatchEffects {
  outlineEnabled: boolean;
  glowEnabled: boolean;
  cleanupEnabled: boolean;
  
  outlineWidth: number;
  outlineColor: string;
  outlineOpacity: number;
  outlineStyle: 'solid' | 'dotted' | 'wavy' | 'pixelated';
  
  glowBlur: number;
  glowColor: string;
  glowOpacity: number;
  
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  
  shadowBlur: number;
  shadowColor: string;
  shadowOpacity: number;
  
  isPixelArt: boolean;
  autoFit: boolean;
  customStickers: CustomSticker[];
  
  // Cleanup & Transparency
  removeBackground: boolean;
  scrubAggression: number; // 0-200
  keepInternalColors: boolean;
  cleanupIntensity: number; // 0-100
}

export interface DesktopAssignments {
  myPc?: string; 
  recycleBinEmpty?: string;
  recycleBinFull?: string;
  startButtonNormal?: string;
  folder?: string;
  network?: string;
  settings?: string;
  extra1?: string;
}

export interface PersonBio {
  name: string;
  knownFor: string;
  vibe: string;
  wallpaperColors: string[];
}

export interface GeneratedPackItem {
  label: string;
  prompt: string;
  blob?: Blob;
  previewUrl?: string;
}
