
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, Upload, RefreshCw, ArrowRightCircle, Sparkles, Box, 
  Image as ImageIcon, Hammer, Move, Maximize, Target, Settings2, 
  Plus, Trash2, Crosshair, ZoomIn, MousePointer2 
} from 'lucide-react';
import { removeBgAndCenter } from '../utils/imageProcessor';
import { GeneratedPackItem, Slice } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface CraftingTableProps {
  onImportToSmithy: (pack: GeneratedPackItem[]) => void;
  onError: (msg: string, fix: string) => void;
}

export const CraftingTable: React.FC<CraftingTableProps> = ({ onImportToSmithy, onError }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const [isSlicing, setIsSlicing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [slicedItems, setSlicedItems] = useState<GeneratedPackItem[]>([]);
  const [keepInternal, setKeepInternal] = useState(true);
  const [aggression, setAggression] = useState(80);
  
  const [dragState, setDragState] = useState<{ mode: 'move' | 'resize' | 'create'; startX: number; startY: number; initialSlice?: Slice } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setSourceImage(url);
        const img = new Image();
        img.onload = () => {
          imgRef.current = img;
          setSlices([]);
          setSlicedItems([]);
          handleSmartScan(url);
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    slices.forEach(slice => {
      const isSelected = slice.id === selectedSliceId;
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#ffff00';
      ctx.lineWidth = Math.max(2, img.width / 400);
      ctx.setLineDash(isSelected ? [] : [10, 5]);
      
      // Draw Box
      ctx.strokeRect(slice.x, slice.y, slice.w, slice.h);
      
      // Draw Semi-transparent Overlay
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 0, 0.05)';
      ctx.fillRect(slice.x, slice.y, slice.w, slice.h);

      if (isSelected) {
        // Resize handle
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(slice.x + slice.w - 10, slice.y + slice.h - 10, 20, 20);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(slice.x + slice.w - 10, slice.y + slice.h - 10, 20, 20);
      }
      
      // Label
      ctx.fillStyle = isSelected ? '#3b82f6' : 'rgba(0,0,0,0.7)';
      const tagH = Math.max(20, img.height / 40);
      ctx.fillRect(slice.x, slice.y - tagH, Math.max(60, slice.w / 2), tagH);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${tagH * 0.6}px Space Mono`;
      ctx.fillText(`SPRITE_${slice.id.slice(0, 4)}`, slice.x + 5, slice.y - tagH * 0.3);
    });
  }, [slices, selectedSliceId]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleSmartScan = async (imgData?: string) => {
    const dataToScan = imgData || sourceImage;
    if (!dataToScan) return;
    setIsScanning(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                { text: "Analyze this sprite sheet. Identify the bounding boxes for all distinct icons. Return JSON: { boxes: [{x: number, y: number, w: number, h: number}] }. Use absolute pixel coordinates relative to the image size." },
                { inlineData: { mimeType: "image/png", data: dataToScan.split(',')[1] } }
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
                                },
                                required: ["x", "y", "w", "h"]
                            }
                        }
                    },
                    required: ["boxes"]
                }
            }
        });
        const r = JSON.parse(response.text || '{"boxes":[]}');
        const detected = r.boxes.map((b: any) => ({ ...b, id: crypto.randomUUID() }));
        setSlices(detected);
    } catch (e) {
        console.error(e);
        onError("Vision Failed", "AI couldn't auto-detect boxes. Draw them manually.");
    } finally { setIsScanning(false); }
  };

  const getCanvasCoords = (e: React.MouseEvent) => {
    if (!canvasRef.current || !imgRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.width / rect.width;
    const scaleY = imgRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);
    
    // Check if we clicked on a resize handle first
    if (selectedSliceId) {
        const slice = slices.find(s => s.id === selectedSliceId);
        if (slice) {
            const handleX = slice.x + slice.w;
            const handleY = slice.y + slice.h;
            const dist = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2));
            if (dist < 40) {
                setDragState({ mode: 'resize', startX: x, startY: y, initialSlice: { ...slice } });
                return;
            }
        }
    }

    // Check if clicked inside a box
    const clickedSlice = [...slices].reverse().find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    if (clickedSlice) {
        setSelectedSliceId(clickedSlice.id);
        setDragState({ mode: 'move', startX: x, startY: y, initialSlice: { ...clickedSlice } });
    } else {
        // Create new box
        setSelectedSliceId(null);
        setDragState({ mode: 'create', startX: x, startY: y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const { x, y } = getCanvasCoords(e);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;

    if (dragState.mode === 'move' && dragState.initialSlice) {
        setSlices(prev => prev.map(s => s.id === selectedSliceId ? {
            ...s,
            x: dragState.initialSlice!.x + dx,
            y: dragState.initialSlice!.y + dy
        } : s));
    } else if (dragState.mode === 'resize' && dragState.initialSlice) {
        setSlices(prev => prev.map(s => s.id === selectedSliceId ? {
            ...s,
            w: Math.max(10, dragState.initialSlice!.w + dx),
            h: Math.max(10, dragState.initialSlice!.h + dy)
        } : s));
    } else if (dragState.mode === 'create') {
        const newSlice = {
            id: 'temp',
            x: Math.min(dragState.startX, x),
            y: Math.min(dragState.startY, y),
            w: Math.abs(x - dragState.startX),
            h: Math.abs(y - dragState.startY)
        } as Slice;
        // Update slices with a temp box
        setSlices(prev => {
            const filtered = prev.filter(s => s.id !== 'temp');
            return [...filtered, newSlice];
        });
    }
  };

  const handleMouseUp = () => {
    if (dragState?.mode === 'create') {
        setSlices(prev => prev.map(s => s.id === 'temp' ? { ...s, id: crypto.randomUUID() } : s).filter(s => s.w > 5 && s.h > 5));
    }
    setDragState(null);
  };

  const startSlicing = async () => {
    if (!imgRef.current || slices.length === 0) return;
    setIsSlicing(true);
    try {
        const img = imgRef.current;
        const results: GeneratedPackItem[] = [];

        for (const slice of slices) {
            const canvas = document.createElement('canvas');
            canvas.width = slice.w;
            canvas.height = slice.h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, slice.x, slice.y, slice.w, slice.h, 0, 0, slice.w, slice.h);
            
            const tempImg = new Image();
            tempImg.src = canvas.toDataURL('image/png');
            await new Promise(res => tempImg.onload = res);
            
            const cleanBlob = await removeBgAndCenter(tempImg, aggression, keepInternal);
            const cleanUrl = URL.createObjectURL(cleanBlob);
            results.push({ label: `SPRITE_${slice.id.slice(0,4)}`, prompt: `Extracted`, blob: cleanBlob, previewUrl: cleanUrl });
        }
        setSlicedItems(results);
    } catch (e) {
        onError("Export Failed", "Slice generation failed.");
    } finally { setIsSlicing(false); }
  };

  const deleteSelected = () => {
    if (selectedSliceId) {
        setSlices(prev => prev.filter(s => s.id !== selectedSliceId));
        setSelectedSliceId(null);
    }
  };

  return (
    <div className="bg-[#111] border-8 border-[#333] p-6 rounded-none shadow-2xl font-mono select-none">
      <div className="flex items-center justify-between mb-6 bg-black/40 p-4 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#c6c6c6] border-2 border-black">
                <Scissors className="text-black" size={24} />
            </div>
            <div>
                <h2 className="text-xl font-black uppercase text-white tracking-widest italic">Workbench.v2</h2>
                <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">Manual Sprite Isolation Matrix</p>
            </div>
          </div>
          <div className="flex gap-3">
              <button 
                onClick={() => handleSmartScan()} 
                disabled={isScanning || !sourceImage}
                className="win-btn bg-indigo-600 text-white gap-2 h-10 px-4"
              >
                {isScanning ? <RefreshCw className="animate-spin" size={14}/> : <Sparkles size={14}/>} AI_SCAN
              </button>
              <button 
                onClick={() => onImportToSmithy(slicedItems)} 
                disabled={slicedItems.length === 0}
                className="win-btn bg-green-700 text-white gap-2 h-10 px-4"
              >
                <ArrowRightCircle size={14}/> IMPORT_SMITHY
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
        <div className="lg:col-span-9 flex flex-col gap-4">
            <div 
                className="relative flex-1 bg-black border-4 border-[#222] overflow-hidden flex items-center justify-center group"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {sourceImage ? (
                    <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pixelated cursor-crosshair shadow-2xl" />
                ) : (
                    <div className="flex flex-col items-center opacity-20 text-white">
                        <Upload size={80} className="mb-4 animate-bounce" />
                        <p className="text-sm font-black uppercase tracking-widest">Drop Sprite Sheet or Click to Load</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    </div>
                )}
                
                <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-black/80 backdrop-blur-md border border-white/20 p-2 flex gap-2 rounded-lg">
                        <button onClick={() => setDragState(null)} className="p-2 text-white hover:bg-white/20 transition-colors"><MousePointer2 size={16}/></button>
                        <div className="w-[1px] h-6 bg-white/10" />
                        <button onClick={deleteSelected} disabled={!selectedSliceId} className="p-2 text-white hover:bg-red-600 disabled:opacity-20 transition-all"><Trash2 size={16}/></button>
                    </div>
                    {slices.length > 0 && (
                        <div className="bg-indigo-600 text-white px-4 py-2 text-[10px] font-black uppercase flex items-center gap-2 border border-white/20">
                            {slices.length} ASSETS_DETECTED
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-[#222] border border-white/10 p-4 grid grid-cols-4 gap-4 items-center">
                <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black text-indigo-400 uppercase">Alpha Focus</label>
                    <button 
                        onClick={() => setKeepInternal(!keepInternal)}
                        className={`w-full py-2 border text-[9px] font-black uppercase transition-all ${keepInternal ? 'bg-indigo-600 text-white border-white' : 'bg-black text-white/40 border-white/10'}`}
                    >
                        {keepInternal ? 'Protect Internal' : 'Global Wipe'}
                    </button>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black text-indigo-400 uppercase">Aggression ({aggression})</label>
                    <input type="range" min="0" max="200" value={aggression} onChange={e => setAggression(+e.target.value)} className="w-full" />
                </div>
                <div className="col-span-2">
                    <button 
                        onClick={startSlicing} 
                        disabled={isSlicing || slices.length === 0}
                        className="w-full bg-white text-black py-3 text-xs font-black uppercase hover:bg-indigo-400 active:scale-95 transition-all shadow-[4px_4px_0_rgba(255,255,255,0.2)]"
                    >
                        {isSlicing ? <RefreshCw className="animate-spin" size={16}/> : <Scissors size={16}/>} RUN_BATCH_EXTRACTION
                    </button>
                </div>
            </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Box size={14}/> OUTPUT_CHAMBER
            </h3>
            <div className="bg-black border-4 border-[#222] flex-1 p-4 overflow-y-auto custom-scrollbar transparent-checker shadow-inner">
                {slicedItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {slicedItems.map((item, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 p-3 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                                <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center p-2 relative">
                                    <img src={item.previewUrl} className="w-full h-full object-contain pixelated" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-white font-black uppercase">{item.label}</span>
                                    <div className="flex gap-1">
                                        <div className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[6px] font-black uppercase border border-green-500/30">LOCKED</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 text-white">
                        <ImageIcon size={48} className="mb-4" />
                        <p className="text-[10px] font-black uppercase">Chamber Empty</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
