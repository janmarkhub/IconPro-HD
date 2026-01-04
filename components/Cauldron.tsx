
import React, { useState } from 'react';
import { Search, X, RefreshCw, Coffee, ArrowRightCircle, Package, Sparkles, Wand2, Scissors } from 'lucide-react';
import { getPackRecommendations, getSubThemes, generatePackPrompts, generateIconGrid } from '../utils/aiVision';
import { removeBgAndCenter } from '../utils/imageProcessor';
import { GeneratedPackItem } from '../types';
import { RetroTooltip } from './RetroTooltip';
import { GoogleGenAI, Type } from "@google/genai";

interface CauldronProps {
  onPackGenerated: (pack: GeneratedPackItem[]) => void;
  onImportToSmithy: (pack: GeneratedPackItem[]) => void;
  onOpenSlicerWithImage?: (dataUrl: string) => void;
  onError: (msg: string, fix: string) => void;
}

export const Cauldron: React.FC<CauldronProps> = ({ onPackGenerated, onImportToSmithy, onOpenSlicerWithImage, onError }) => {
  const [activePath, setActivePath] = useState<'source' | 'theme'>('source');
  const [fetchFrom, setFetchFrom] = useState('');
  const [whichFrom, setWhichFrom] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('Default Pixel');
  const [selectedMainTheme, setSelectedMainTheme] = useState<string | null>(null);
  const [subThemes, setSubThemes] = useState<string[]>([]);
  const [selectedSubTheme, setSelectedSubTheme] = useState<string | null>(null);
  const [isCooking, setIsCooking] = useState(false);
  const [cookProgress, setCookProgress] = useState(0);
  const [cookMessage, setCookMessage] = useState('');
  const [lastGeneratedPack, setLastGeneratedPack] = useState<GeneratedPackItem[]>([]);
  const [lastMasterGrid, setLastMasterGrid] = useState<string | null>(null);

  const mainThemes = ["Gaming", "Retro", "Meme", "Windows Like"];
  const styleOptions = ["Default Pixel", "32-bit Glossy", "Shiny Glass", "Dark Knight", "Retro CRT", "Gold Plated", "Cyberpunk Neon", "Cute Pastel", "3D Clay"];

  const handleSourceRecs = async () => {
    if (!fetchFrom.trim()) return onError("Ingredient Missing", "Specify a source first.");
    setIsRecommending(true);
    try {
      const recs = await getPackRecommendations(fetchFrom);
      setRecommendations(recs);
      if (recs.length > 0) setWhichFrom(recs[0]);
    } catch (e) {
      onError("Cauldron Instability", "Vision model timed out.");
    } finally {
      setIsRecommending(false);
    }
  };

  const handleThemeSelect = async (theme: string) => {
    setSelectedMainTheme(theme);
    setSelectedSubTheme(null);
    try {
      const subs = await getSubThemes(theme);
      setSubThemes(subs);
    } catch (e) {
      onError("Theme Vision Blurry", "Distillation failed.");
    }
  };

  const startCooking = async () => {
    const source = activePath === 'source' ? fetchFrom : selectedMainTheme;
    const category = activePath === 'source' ? whichFrom : selectedSubTheme;
    if (!source || !category) return onError("Recipe Incomplete", "Fill all ingredients.");
    
    setIsCooking(true); setCookProgress(5); setCookMessage("Researching visual archetypes...");
    try {
      const { items, masterPrompt } = await generatePackPrompts(source, category, selectedStyle);
      setCookProgress(20); setCookMessage("Summoning Sprite Sheet...");
      
      const gridDataUrl = await generateIconGrid(masterPrompt);
      setLastMasterGrid(gridDataUrl);
      setCookProgress(40); setCookMessage("Locating individual icons...");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const detectResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
              { text: "Identify bounding boxes for all 10 icons in this 5x2 sprite sheet. Return JSON: { boxes: [{x, y, w, h}] } in pixels." },
              { inlineData: { mimeType: "image/png", data: gridDataUrl.split(',')[1] } }
          ],
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      boxes: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  x: { type: Type.NUMBER },
                                  y: { type: Type.NUMBER },
                                  w: { type: Type.NUMBER },
                                  h: { type: Type.NUMBER }
                              }
                          }
                      }
                  }
              }
          }
      });

      const detectResult = JSON.parse(detectResponse.text || '{"boxes":[]}');
      const boxes = detectResult.boxes;

      setCookProgress(60); setCookMessage("Extracting & Alpha Scrubbing...");
      
      const masterImg = new Image();
      await new Promise(res => { masterImg.onload = res; masterImg.src = gridDataUrl; });
      
      const results: GeneratedPackItem[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        canvas.width = box.w;
        canvas.height = box.h;
        ctx.clearRect(0, 0, box.w, box.h);
        ctx.drawImage(masterImg, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        
        const intermediate = new Image();
        intermediate.src = canvas.toDataURL('image/png');
        await new Promise(res => intermediate.onload = res);
        
        const cleanBlob = await removeBgAndCenter(intermediate);
        const cleanUrl = URL.createObjectURL(cleanBlob);
        
        results.push({ 
            label: items[i]?.label || `Icon ${i+1}`, 
            prompt: `Generated ${items[i]?.label}`, 
            blob: cleanBlob, 
            previewUrl: cleanUrl 
        });
        setCookProgress(60 + (i / boxes.length) * 40);
      }
      setLastGeneratedPack(results);
      onPackGenerated(results);
      setCookMessage("Brewing Complete!");
    } catch (e) {
      console.error(e);
      onError("Cauldron Overload", "Batch generation failed.");
    } finally {
      setTimeout(() => setIsCooking(false), 1000);
    }
  };

  return (
    <div className="bg-[#c6c6c6] border-8 border-t-[#ffffff] border-l-[#ffffff] border-r-[#555555] border-b-[#555555] p-12 rounded-sm shadow-2xl relative">
      {isCooking && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-14 text-center">
          <Coffee size={100} className="text-indigo-400 animate-pulse mb-10" />
          <p className="text-white font-black uppercase tracking-[0.6em] mb-10 text-xl">{cookMessage}</p>
          <div className="w-full max-w-2xl h-8 bg-[#333] border-4 border-white p-1.5 shadow-2xl">
            <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${cookProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-12 border-b-4 border-[#555] pb-8">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-indigo-900 border-4 border-indigo-400 shadow-[8px_8px_0_rgba(0,0,0,0.4)]">
            <Package className="text-indigo-200" size={48} />
          </div>
          <div>
            <h2 className="text-5xl font-black uppercase text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] tracking-tighter italic">The Cauldron</h2>
          </div>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setActivePath('source')} className={`px-10 py-4 text-[12px] font-black uppercase border-4 transition-all ${activePath === 'source' ? 'bg-[#555] text-white border-white scale-105' : 'bg-[#8b8b8b] text-[#333] border-transparent'}`}>Source Mode</button>
           <button onClick={() => setActivePath('theme')} className={`px-10 py-4 text-[12px] font-black uppercase border-4 transition-all ${activePath === 'theme' ? 'bg-[#555] text-white border-white scale-105' : 'bg-[#8b8b8b] text-[#333] border-transparent'}`}>Theme Mode</button>
        </div>
      </div>

      {activePath === 'source' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-4 space-y-4">
            <label className="text-[12px] font-black text-white uppercase tracking-widest block">IP Ingredient:</label>
            <input type="text" value={fetchFrom} onChange={e => setFetchFrom(e.target.value)} placeholder="e.g. Star Wars" className="w-full bg-[#333] border-4 border-[#555] p-6 text-sm text-white uppercase font-black outline-none" />
          </div>
          <div className="md:col-span-2">
            <button onClick={handleSourceRecs} disabled={isRecommending} className="w-full py-6 bg-indigo-600 border-4 border-white/20 text-white text-[13px] font-black uppercase">
                {isRecommending ? <RefreshCw className="animate-spin" size={24} /> : "Scan Lore"}
            </button>
          </div>
          <div className="md:col-span-4 space-y-4">
            <label className="text-[12px] font-black text-white uppercase tracking-widest block">Sub-Set:</label>
            <input type="text" value={whichFrom} onChange={e => setWhichFrom(e.target.value)} placeholder="e.g. Jedi Tools" className="w-full bg-[#333] border-4 border-[#555] p-6 text-sm text-white uppercase font-black outline-none" />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-4 gap-6">
            {mainThemes.map(t => (
                <button key={t} onClick={() => handleThemeSelect(t)} className={`p-10 border-4 uppercase font-black text-xl tracking-tighter transition-all ${selectedMainTheme === t ? 'bg-indigo-600 text-white border-white scale-105' : 'bg-[#8b8b8b] text-[#333] border-[#555]'}`}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {lastGeneratedPack.length > 0 && !isCooking && (
        <div className="mt-14 p-10 bg-indigo-900/40 border-8 border-indigo-400 animate-in slide-in-from-bottom-8">
            <div className="flex items-center justify-between mb-10 border-b-2 border-indigo-400/30 pb-8">
                <div>
                    <span className="text-3xl text-white font-black uppercase tracking-tighter italic">Generation Complete</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => onImportToSmithy(lastGeneratedPack)} className="px-10 py-5 bg-indigo-600 text-white border-4 border-white text-[14px] font-black uppercase flex items-center gap-4 hover:bg-indigo-500 shadow-2xl active:scale-95 transition-all"><ArrowRightCircle size={28}/> Smelt All</button>
                    {lastMasterGrid && onOpenSlicerWithImage && (
                        <button onClick={() => onOpenSlicerWithImage(lastMasterGrid)} className="px-10 py-5 bg-[#555] text-white border-4 border-white text-[14px] font-black uppercase flex items-center gap-4 hover:bg-[#666] shadow-2xl"><Scissors size={28}/> Open in Slicer</button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-5 gap-6">
                {lastGeneratedPack.map((item, idx) => (
                    <div key={idx} className="bg-black/50 border-4 border-white/10 p-5 flex flex-col items-center">
                        <div className="w-24 h-24 transparent-checker border-2 border-white/10 p-2 mb-4 flex items-center justify-center">
                            <img src={item.previewUrl} className="w-full h-full object-contain pixelated" />
                        </div>
                        <span className="text-[9px] text-white/80 text-center uppercase font-black truncate w-full">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="mt-14 pt-12 border-t-8 border-[#555] flex justify-center">
          <button onClick={startCooking} className="w-full max-w-2xl py-10 bg-[#4d2a7c] border-[14px] border-t-[#6b3fb4] border-l-[#6b3fb4] border-r-[#221338] border-b-[#221338] text-white text-3xl font-black uppercase tracking-[0.5em] shadow-[16px_16px_0_rgba(0,0,0,0.6)] hover:brightness-125 hover:scale-[1.01] transition-all">Summon Pack</button>
      </div>
    </div>
  );
};
