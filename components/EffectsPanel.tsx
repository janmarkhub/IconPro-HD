
import React, { useState } from 'react';
import { BatchEffects } from '../types';
import { DEFAULT_EFFECTS } from '../utils/imageProcessor';
import { 
  Info, Hammer, Palette, Sparkles, Box, 
  Cpu, Camera, Zap
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { RetroTooltip } from './RetroTooltip';

interface EffectsPanelProps {
  effects: BatchEffects;
  setEffects: React.Dispatch<React.SetStateAction<BatchEffects>>;
  disabled: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onError: (msg: string, fix: string) => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ effects, setEffects, disabled, onUndo, canUndo, onError }) => {
  const [isHammerHovered, setIsHammerHovered] = useState(false);
  const [lastState, setLastState] = useState<Partial<BatchEffects> | null>(null);

  const update = (key: keyof BatchEffects, val: any) => {
    setEffects(prev => ({ ...prev, [key]: val }));
  };

  const handleHammerClick = () => {
    if (lastState) {
        setEffects(prev => ({ ...prev, ...lastState }));
        setLastState(null);
    } else {
        const randomChanges: Partial<BatchEffects> = {
            rgbSplit: Math.random() * 8,
            tvNoise: Math.random() * 15,
            pixelSort: Math.random() * 20,
            chromaticAberration: Math.random() * 10
        };
        setLastState({
            rgbSplit: effects.rgbSplit,
            tvNoise: effects.tvNoise,
            pixelSort: effects.pixelSort,
            chromaticAberration: effects.chromaticAberration
        });
        setEffects(prev => ({ ...prev, ...randomChanges }));
    }
  };

  const handleInspireMe = async () => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const resp = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Propose a complete JSON for BatchEffects. Theme: 'Neo-Retro Cyber Forge'. Return only JSON.",
            config: { responseMimeType: "application/json" }
        });
        const inspired = JSON.parse(resp.text || '{}');
        setEffects(prev => ({ ...prev, ...inspired }));
    } catch(e) { console.error("AI Inspiration failed", e); }
  };

  const ControlGroup = ({ title, icon: Icon, children, info }: any) => (
    <div className="retro-panel p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-black/20 pb-1">
        <div className="flex items-center gap-1.5">
            <Icon size={12} className="text-[#333]" />
            <h4 className="text-[9px] font-bold uppercase text-[#333] tracking-tighter">{title}</h4>
        </div>
        {info && (
            <div className="relative group/info">
                <Info size={10} className="text-[#333] opacity-30 cursor-help" />
                <div className="absolute right-0 bottom-full mb-2 w-40 p-2 bg-black border border-white text-[7px] text-white shadow-xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity z-[100] uppercase font-bold">
                    {info}
                </div>
            </div>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const SliderField = ({ label, value, min, max, onChange, step = 1, suffix = "", tooltipTitle, tooltipDesc }: any) => (
    <RetroTooltip title={tooltipTitle} description={tooltipDesc}>
      <div className="w-full">
        <div className="flex justify-between text-[7px] text-[#333] font-bold uppercase mb-0.5">
          <span className="truncate">{label}</span>
          <span>{value}{suffix}</span>
        </div>
        <input 
          type="range" min={min} max={max} step={step} value={value} 
          onChange={e => onChange(+e.target.value)} className="w-full cursor-pointer" 
        />
      </div>
    </RetroTooltip>
  );

  const ToggleField = ({ label, active, onToggle, tooltipTitle, tooltipDesc }: any) => (
    <RetroTooltip title={tooltipTitle} description={tooltipDesc}>
      <div className="flex items-center justify-between p-1 bg-[#d6d6d6] border border-black/10">
          <span className="text-[7px] font-bold text-[#333] uppercase truncate">{label}</span>
          <button 
            onClick={onToggle} 
            className={`px-1.5 py-0.5 border text-[6px] font-black uppercase transition-all ${active ? 'bg-indigo-600 text-white border-white' : 'bg-[#bbb] border-black/40 text-[#444]'}`}
          >
              {active ? 'ON' : 'OFF'}
          </button>
      </div>
    </RetroTooltip>
  );

  return (
    <div className={`w-full retro-panel p-4 mb-4 transition-all ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-4 border-b border-black/10 pb-2">
        <div className="flex items-center gap-3">
          <div onClick={handleHammerClick} className="win-btn p-2 text-indigo-700 cursor-pointer">
            <Hammer size={18} className={isHammerHovered ? 'animate-mosh-shake' : ''} />
          </div>
          <div>
            <h3 className="font-bold text-lg uppercase text-[#333] tracking-tighter">SMITHY_CORE.SYS</h3>
            <p className="text-[7px] text-[#666] font-bold uppercase tracking-widest">BATCH_REFINEMENT_STATION</p>
          </div>
        </div>
        
        <div className="flex gap-2">
            <button onClick={handleInspireMe} className="win-btn bg-indigo-600 text-white border-white">
                <Zap size={10} className="inline mr-1" /> AI_BLESS
            </button>
            <button onClick={() => setEffects(DEFAULT_EFFECTS)} className="win-btn bg-red-600 text-white">
                WIPE_FX
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ControlGroup title="FOUNDRY" icon={Box}>
             <SliderField label="Rounding" value={effects.cornerRadius} min={0} max={100} onChange={v => update('cornerRadius', v)} tooltipTitle="Rounding" tooltipDesc="Smooth edges." />
             <ToggleField label="ASCII" active={effects.asciiMode} onToggle={() => update('asciiMode', !effects.asciiMode)} tooltipTitle="ASCII" tooltipDesc="Terminal look." />
             <div className="flex justify-between items-center text-[7px] font-bold text-[#333] uppercase">
                 <span>DEPTH</span>
                 <select value={effects.pixelDepth} onChange={e => update('pixelDepth', e.target.value)} className="bg-[#eee] border border-black px-1 text-[7px] outline-none">
                   <option value="none">Lossless</option>
                   <option value="32-bit">32-bit</option>
                   <option value="8-bit">8-bit</option>
                 </select>
             </div>
        </ControlGroup>

        <ControlGroup title="NORMALIZE" icon={Cpu}>
            <ToggleField label="Uniform" active={effects.normalizeInputs} onToggle={() => update('normalizeInputs', !effects.normalizeInputs)} tooltipTitle="Normalize" tooltipDesc="Sync sizes." />
            <ToggleField label="Alpha" active={effects.removeBackground} onToggle={() => update('removeBackground', !effects.removeBackground)} tooltipTitle="Alpha" tooltipDesc="Auto-transparency." />
            <SliderField label="Upscale" value={effects.smartUpscaleIntensity} min={0} max={100} onChange={v => update('smartUpscaleIntensity', v)} tooltipTitle="Upscale" tooltipDesc="Smooth HD." />
        </ControlGroup>

        <ControlGroup title="ALCHEMY" icon={Sparkles}>
          <ToggleField label="Enchant" active={effects.enchantmentGlint} onToggle={() => update('enchantmentGlint', !effects.enchantmentGlint)} tooltipTitle="Glint" tooltipDesc="RPG glint." />
          <SliderField label="Metal" value={effects.metallicIntensity} min={0} max={100} onChange={v => update('metallicIntensity', v)} tooltipTitle="Metal" tooltipDesc="Chrome look." />
          <input type="color" value={effects.outlineColor} onChange={e => update('outlineColor', e.target.value)} className="w-full h-4 border border-black cursor-pointer" />
        </ControlGroup>

        <ControlGroup title="OPTICS" icon={Camera}>
            <ToggleField label="Dither" active={effects.dither} onToggle={() => update('dither', !effects.dither)} tooltipTitle="Dither" tooltipDesc="CRT look." />
            <SliderField label="Fringe" value={effects.chromaticAberration} min={0} max={20} onChange={v => update('chromaticAberration', v)} tooltipTitle="Fringe" tooltipDesc="Lens effect." />
            <SliderField label="Vignette" value={effects.vignette} min={0} max={100} onChange={v => update('vignette', v)} tooltipTitle="Vignette" tooltipDesc="Dark corners." />
        </ControlGroup>
      </div>
    </div>
  );
};
