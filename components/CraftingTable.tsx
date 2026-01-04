
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, Upload, RefreshCw, ArrowRightCircle, Sparkles, Box, 
  Info, Image as ImageIcon, Hammer, Move, Maximize, Target, Eraser, Settings2, MousePointer2 
} from 'lucide-react';
import { removeBgAndCenter } from '../utils/imageProcessor';
import { GeneratedPackItem } from '../types';
import { RetroTooltip } from './RetroTooltip';
import { GoogleGenAI, Type } from "@google/genai";

interface CraftingTableProps {
  onImportToSmithy: (pack: GeneratedPackItem[]) => void;
  onError: (msg: string, fix: string) => void;
}

export const CraftingTable: React.FC<CraftingTableProps> = ({ onImportToSmithy, onError }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(5);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [gapX, setGapX] = useState(0);
  const [gapY, setGapY] = useState(0);
  const [cellWidth, setCellWidth] = useState(0);
  const [cellHeight, setCellHeight] = useState(0);
  
  const [isSlicing, setIsSlicing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [slicedItems, setSlicedItems] = useState<GeneratedPackItem[]>([]);
  const [keepInternal, setKeepInternal] = useState(true);
  const [aggression, setAggression] = useState(80);
  
  const [dragMode, setDragMode] = useState<'none' | 'grid' | 'resize'>('none');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

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
          setCellWidth(Math.floor(img.width / cols) - 10);
          setCellHeight(Math.floor(img.height / rows) - 10);
          setOffsetX(5);
          setOffsetY(5);
          setGapX(10);
          setGapY(10);
        };
        img.src = url;
        setSlicedItems([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    canvas.width = img.width;
    canvas.height = img.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Grid Visuals
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = Math.max(2, img.width / 400);
    ctx.setLineDash([8, 4]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * (cellWidth + gapX);
        const y = offsetY + r * (cellHeight + gapY);
        
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        // Handle visualization
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(x + cellWidth - 5, y + cellHeight - 5, 10, 10);
        
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const tagSize = Math.floor(18 * (img.width / 1024));
        ctx.fillRect(x, y, tagSize * 2, tagSize);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${tagSize * 0.7}px Space Mono`;
        ctx.fillText(`${r},${c}`, x + 4, y + tagSize * 0.75);
      }
    }
  }, [rows, cols, offsetX, offsetY, gapX, gapY, cellWidth, cellHeight]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const handleSmartScan = async () => {
    if (!sourceImage) return onError("Visuals Missing", "Input a sprite sheet first.");
    setIsScanning(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                { text: "Analyze this sprite sheet. Estimate the grid configuration (rows, cols) and the approximate padding/offset. Return JSON: { rows: number, cols: number, offsetX: number, offsetY: number, cellWidth: number, cellHeight: number, gapX: number, gapY: number }." },
                { inlineData: { mimeType: "image/png", data: sourceImage.split(',')[1] } }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rows: { type: Type.NUMBER },
                        cols: { type: Type.NUMBER },
                        offsetX: { type: Type.NUMBER },
                        offsetY: { type: Type.NUMBER },
                        cellWidth: { type: Type.NUMBER },
                        cellHeight: { type: Type.NUMBER },
                        gapX: { type: Type.NUMBER },
                        gapY: { type: Type.NUMBER }
                    },
                    required: ["rows", "cols", "offsetX", "offsetY", "cellWidth", "cellHeight", "gapX", "gapY"]
                }
            }
        });
        const r = JSON.parse(response.text || '{}');
        setRows(r.rows); setCols(r.cols);
        setOffsetX(r.offsetX); setOffsetY(r.offsetY);
        setCellWidth(r.cellWidth); setCellHeight(r.cellHeight);
        setGapX(r.gapX); setGapY(r.gapY);
    } catch (e) {
        onError("AI Alignment Failed", "Vision link unstable. Manual alignment active.");
    } finally {
        setIsScanning(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.width / rect.width;
    const scaleY = imgRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicking resize handle (bottom-right of cell 0,0 for simplicity or any cell)
    // We'll use the first cell as the "Master Resize" handle
    const handleX = offsetX + cellWidth;
    const handleY = offsetY + cellHeight;
    const dist = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2));

    if (dist < 30) {
      setDragMode('resize');
    } else {
      setDragMode('grid');
    }
    setStartPos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragMode === 'none' || !imgRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.width / rect.width;
    const scaleY = imgRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const dx = x - startPos.x;
    const dy = y - startPos.y;

    if (dragMode === 'grid') {
      setOffsetX(prev => prev + dx);
      setOffsetY(prev => prev + dy);
    } else if (dragMode === 'resize') {
      setCellWidth(prev => Math.max(10, prev + dx));
      setCellHeight(prev => Math.max(10, prev + dy));
    }
    setStartPos({ x, y });
  };

  const handleMouseUp = () => setDragMode('none');

  const startSlicing = async () => {
    if (!imgRef.current) return;
    setIsSlicing(true);
    try {
        const img = imgRef.current;
        const results: GeneratedPackItem[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = offsetX + c * (cellWidth + gapX);
                const y = offsetY + r * (cellHeight + gapY);
                
                const canvas = document.createElement('canvas');
                canvas.width = cellWidth;
                canvas.height = cellHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, x, y, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
                
                const tempImg = new Image();
                tempImg.src = canvas.toDataURL('image/png');
                await new Promise(res => tempImg.onload = res);
                
                const cleanBlob = await removeBgAndCenter(tempImg, aggression, keepInternal);
                const cleanUrl = URL.createObjectURL(cleanBlob);
                results.push({ label: `Slot_${r}_${c}`, prompt: `Crafted`, blob: cleanBlob, previewUrl: cleanUrl });
            }
        }
        setSlicedItems(results);
    } catch (e) {
        onError("Crafting Fail", "Alignment logic error.");
    } finally {
        setIsSlicing(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border-8 border-[#333] p-8 rounded-none shadow-2xl font-mono relative overflow-hidden select-none">
      <div className="flex items-center justify-between mb-8 border-b-2 border-white/10 pb-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#c6c6c6] border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)]">
                <Hammer className="text-black" size={32} />
            </div>
            <div>
                <h2 className="text-2xl font-black uppercase text-white tracking-widest italic">CRAFTING_BOARD.EXE</h2>
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Photoshop-style Interactive Sprite Extractor</p>
            </div>
          </div>
          <div className="flex gap-4">
              <button 
                onClick={handleSmartScan} 
                disabled={isScanning || !sourceImage}
                className="win-btn bg-indigo-600 text-white gap-2 h-12 px-6"
              >
                {isScanning ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>} SMART_SYNC
              </button>
              <button 
                onClick={() => onImportToSmithy(slicedItems)} 
                disabled={slicedItems.length === 0}
                className="win-btn bg-green-700 text-white gap-2 h-12 px-6"
              >
                <ArrowRightCircle size={16}/> SMITHY_ALL
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
            <div 
                className="relative bg-black border-4 border-[#333] min-h-[500px] flex items-center justify-center cursor-move overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {sourceImage ? (
                    <canvas ref={canvasRef} className="max-w-full max-h-[700px] object-contain pixelated pointer-events-none" />
                ) : (
                    <div className="flex flex-col items-center opacity-20 text-white text-center p-20">
                        <Upload size={64} className="mb-6 animate-bounce" />
                        <p className="text-sm font-black uppercase">Click to Load Sprite Sheet</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    </div>
                )}
                {dragMode !== 'none' && (
                    <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[8px] font-black px-2 py-1 uppercase shadow-lg">
                        {dragMode.toUpperCase()}ING...
                    </div>
                )}
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 bg-[#222] border border-white/5 shadow-inner">
                <div className="space-y-2">
                    <label className="text-[8px] font-black text-indigo-300 uppercase">Grid Config</label>
                    <div className="flex gap-2">
                        <input type="number" value={rows} onChange={e => setRows(+e.target.value)} className="w-1/2 bg-black border border-white/10 p-2 text-white text-xs font-black" />
                        <input type="number" value={cols} onChange={e => setCols(+e.target.value)} className="w-1/2 bg-black border border-white/10 p-2 text-white text-xs font-black" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[8px] font-black text-indigo-300 uppercase">Gaps (X/Y)</label>
                    <div className="flex gap-2">
                        <input type="number" value={gapX} onChange={e => setGapX(+e.target.value)} className="w-1/2 bg-black border border-white/10 p-2 text-white text-xs font-black" />
                        <input type="number" value={gapY} onChange={e => setGapY(+e.target.value)} className="w-1/2 bg-black border border-white/10 p-2 text-white text-xs font-black" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[8px] font-black text-indigo-300 uppercase">Alpha Focus</label>
                    <div 
                        onClick={() => setKeepInternal(!keepInternal)}
                        className={`w-full p-2 border cursor-pointer flex items-center justify-center transition-all ${keepInternal ? 'bg-indigo-600 border-white text-white' : 'bg-black border-white/10 text-white/40'}`}
                    >
                        <span className="text-[9px] font-black uppercase">{keepInternal ? 'KEEP_FILLS' : 'CLEAR_ALL'}</span>
                    </div>
                </div>
                <div className="flex items-end">
                    <button 
                        onClick={startSlicing} 
                        disabled={isSlicing || !sourceImage}
                        className="w-full bg-white text-black h-10 text-[10px] font-black uppercase hover:bg-indigo-400 transition-all shadow-[4px_4px_0_rgba(255,255,255,0.2)]"
                    >
                        {isSlicing ? <RefreshCw className="animate-spin" size={16}/> : <Scissors size={16}/>} RUN_EXTRACT
                    </button>
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Box size={14}/> OUTPUT_BUFFER
            </h3>
            <div className="bg-black/40 border-4 border-[#333] flex-1 min-h-[500px] p-4 overflow-y-auto custom-scrollbar shadow-inner">
                {slicedItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {slicedItems.map((item, idx) => (
                            <div key={idx} className="aspect-square bg-white border border-black p-2 flex items-center justify-center transparent-checker group relative overflow-hidden shadow-2xl hover:scale-105 transition-transform">
                                <img src={item.previewUrl} className="w-full h-full object-contain pixelated" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="text-[7px] text-white font-black uppercase bg-black px-2 py-1">READY</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-10">
                        <ImageIcon size={64} className="mb-4" />
                        <p className="text-[10px] font-black uppercase">Buffer Empty</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
