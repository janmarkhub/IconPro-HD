
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { Controls } from './components/Controls';
import { Gallery } from './components/Gallery';
import { EffectsPanel } from './components/EffectsPanel';
import { StickerClipboard } from './components/StickerClipboard';
import { Desktop } from './components/Desktop';
import { Cauldron } from './components/Cauldron';
import { FloatingHelp } from './components/FloatingHelp';
import { ControlMatrix } from './components/ControlMatrix';
import { PaletteForge } from './components/PaletteForge';
import { RetroTooltip } from './components/RetroTooltip';
import { ProcessedFile, Resolution, ExportFormat, BatchEffects, DesktopAssignments, GeneratedPackItem, PersonBio } from './types';
import { parseIcoAndGetLargestImage } from './utils/icoParser';
import { upscaleAndEditImage, DEFAULT_EFFECTS, calculateFidelity, removeBgAndCenter } from './utils/imageProcessor';
import { wrapPngInIco } from './utils/icoEncoder';
import { generateIconImage, getPersonProfile, generatePackPrompts, generateIconGrid } from './utils/aiVision';
import { Hammer, Wand2, Monitor, AlertTriangle, Coffee, Sun, Moon, Sparkles } from 'lucide-react';

declare var JSZip: any;
declare var saveAs: any;

interface FileSource {
  id: string;
  image: HTMLImageElement;
  rawUrl: string; 
  cropBox?: [number, number, number, number];
  fidelity: number;
  prompt?: string;
  label?: string;
}

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mode, setMode] = useState<'upscale' | 'test' | 'cauldron'>('upscale');
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [resolution, setResolution] = useState<Resolution>(Resolution.FHD);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.ICO);
  const [isProcessing, setIsProcessing] = useState(false);
  const [effects, setEffects] = useState<BatchEffects>(DEFAULT_EFFECTS);
  const [showComparison, setShowComparison] = useState(false);
  const [desktopAssignments, setDesktopAssignments] = useState<DesktopAssignments>({});
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ msg: string, fix: string } | null>(null);
  const [currentPerson, setCurrentPerson] = useState<PersonBio | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [toolboxOpen, setToolboxOpen] = useState(true);

  const sourceCache = useRef<Map<string, FileSource>>(new Map());

  const triggerGratification = (action: string) => {
    setLastAction(action);
    setTimeout(() => setLastAction(null), 3000);
  };

  const applyEffectsToFiles = useCallback(async () => {
    if (files.length === 0) return;
    const updatedFiles = await Promise.all(files.map(async (file) => {
      const source = sourceCache.current.get(file.id);
      if (!source) return file;
      try {
        const editedPngBlob = await upscaleAndEditImage(source.image, resolution, effects, source.cropBox, source.fidelity);
        let finalBlob = editedPngBlob;
        if (exportFormat === ExportFormat.ICO) finalBlob = await wrapPngInIco(editedPngBlob);
        const newName = file.originalName.replace(/\.[^/.]+$/, "") + `.${exportFormat}`;
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
        return { ...file, blob: finalBlob, newName, previewUrl: URL.createObjectURL(editedPngBlob), status: 'completed' as const };
      } catch (err) { return file; }
    }));
    setFiles(updatedFiles);
    triggerGratification('SMITHY_SYNC');
  }, [effects, resolution, exportFormat, files.length]);

  useEffect(() => {
    const timer = setTimeout(applyEffectsToFiles, 300);
    return () => clearTimeout(timer);
  }, [effects, resolution, exportFormat, files.length]);

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setIsProcessing(true);
    const newFiles = [];
    for (const file of selectedFiles) {
      const id = crypto.randomUUID();
      try {
        let rawBlob = file.name.toLowerCase().endsWith('.ico') ? await parseIcoAndGetLargestImage(file) : file;
        const rawUrl = URL.createObjectURL(rawBlob);
        const tempImg = new Image();
        await new Promise(res => { tempImg.onload = res; tempImg.src = rawUrl; });
        const fidelity = calculateFidelity(tempImg);
        sourceCache.current.set(id, { id, image: tempImg, rawUrl, fidelity });
        const initialPng = await upscaleAndEditImage(tempImg, resolution, effects, undefined, fidelity);
        newFiles.push({
          id, originalName: file.name, newName: file.name.replace(/\.[^/.]+$/, "") + "." + exportFormat,
          blob: initialPng, previewUrl: URL.createObjectURL(initialPng), status: 'completed' as const, width: resolution, height: resolution,
          originalType: file.type, fidelityScore: fidelity
        });
      } catch (e) { setErrorInfo({ msg: "Asset Error", fix: "Try a cleaner image file." }); }
    }
    setFiles(prev => [...newFiles, ...prev]);
    setIsProcessing(false);
    triggerGratification('ASSETS_IMPORTED');
  }, [resolution, effects, exportFormat]);

  const handleTeleport = async (name: string) => {
    setIsProcessing(true);
    triggerGratification('WARP_INITIATED');
    try {
      const profile = await getPersonProfile(name);
      if (!profile) {
        setErrorInfo({ msg: "Teleportation Failed", fix: "Target digital footprint not found. Try a famous icon." });
        return;
      }
      setCurrentPerson(profile);
      
      const { items, masterPrompt } = await generatePackPrompts(profile.name, profile.vibe, "Clean High Detail Professional");
      const gridDataUrl = await generateIconGrid(masterPrompt);
      const masterImg = new Image();
      await new Promise(res => { masterImg.onload = res; masterImg.src = gridDataUrl; });
      
      const cols = 5; const cellW = masterImg.width / cols; const cellH = masterImg.height / 2;
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = 1024; sliceCanvas.height = 1024; // High res slices
      const sctx = sliceCanvas.getContext('2d')!;
      
      const newAssignments: any = {};
      const slotMap: (keyof DesktopAssignments)[] = ['recycleBinEmpty', 'recycleBinFull', 'startButtonNormal', 'myPc', 'controlPanel', 'network', 'account', 'folder', 'extra1', 'extra2'];

      for (let i = 0; i < 10; i++) {
        const r = Math.floor(i / cols); const c = i % cols;
        sctx.clearRect(0, 0, 1024, 1024);
        sctx.drawImage(masterImg, c * cellW, r * cellH, cellW, cellH, 128, 128, 768, 768);
        const sliceImg = new Image();
        sliceImg.src = sliceCanvas.toDataURL('image/png');
        await new Promise(res => sliceImg.onload = res);
        
        const cleanBlob = await removeBgAndCenter(sliceImg);
        const id = crypto.randomUUID();
        const url = URL.createObjectURL(cleanBlob);
        const finalImg = new Image();
        await new Promise(res => { finalImg.onload = res; finalImg.src = url; });
        
        sourceCache.current.set(id, { id, image: finalImg, rawUrl: url, fidelity: 100, prompt: items[i].label, label: items[i].label });
        
        const fileObj: ProcessedFile = {
          id, originalName: `${items[i].label}.png`, newName: `${items[i].label}.${exportFormat}`,
          blob: cleanBlob, previewUrl: url, status: 'completed', width: resolution, height: resolution,
          originalType: 'image/png', fidelityScore: 100, isAiGenerated: true
        };
        
        setFiles(prev => [...prev, fileObj]);
        newAssignments[slotMap[i]] = id;
      }
      setDesktopAssignments(newAssignments);
      triggerGratification(`ARRIVED AT ${profile.name.toUpperCase()}`);
    } catch (e) {
      setErrorInfo({ msg: "Warp Failure", fix: "Signal lost. Check your connection or API key." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAction = async (action: string, payload?: any) => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      if (action === 'delete') {
        setFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
        triggerGratification('PURGED');
      } else if (action === 'make-transparent' || action === 'center-icon') {
        const updatedFiles = [...files];
        for (const id of selectedIds) {
            const idx = updatedFiles.findIndex(f => f.id === id);
            const src = sourceCache.current.get(id);
            if (idx === -1 || !src) continue;
            
            const cleanBlob = await removeBgAndCenter(src.image);
            const cleanUrl = URL.createObjectURL(cleanBlob);
            const cleanImg = new Image();
            await new Promise(res => { cleanImg.onload = res; cleanImg.src = cleanUrl; });
            
            sourceCache.current.set(id, { ...src, image: cleanImg, rawUrl: cleanUrl });
            updatedFiles[idx] = { ...updatedFiles[idx], previewUrl: cleanUrl, blob: cleanBlob };
        }
        setFiles(updatedFiles);
        triggerGratification('ALPHA_FIXED');
      } else if (action === 'reroll' || action === 'change-style' || action === 'guide-prompt') {
        const updatedFiles = [...files];
        for (const id of selectedIds) {
          const fileIdx = updatedFiles.findIndex(f => f.id === id);
          const source = sourceCache.current.get(id);
          if (fileIdx === -1 || !source) continue;

          updatedFiles[fileIdx] = { ...updatedFiles[fileIdx], status: 'processing' };
          setFiles([...updatedFiles]);

          let finalPrompt = source.prompt || source.label || "icon";
          if (action === 'change-style') finalPrompt = `Icon representing ${source.label}. Style: ${payload}. Pro quality.`;
          else if (action === 'guide-prompt') finalPrompt = `Icon of ${source.label}. ${payload}. High detail.`;

          const newDataUrl = await generateIconImage(finalPrompt);
          const tempImg = new Image();
          await new Promise(r => { tempImg.onload = r; tempImg.src = newDataUrl; });
          
          const cleanBlob = await removeBgAndCenter(tempImg);
          const cleanUrl = URL.createObjectURL(cleanBlob);
          const cleanImg = new Image();
          await new Promise(r => { cleanImg.onload = r; cleanImg.src = cleanUrl; });

          sourceCache.current.set(id, { ...source, image: cleanImg, rawUrl: cleanUrl });
          updatedFiles[fileIdx] = {
            ...updatedFiles[fileIdx], blob: cleanBlob, previewUrl: cleanUrl, status: 'completed'
          };
          setFiles([...updatedFiles]);
        }
        triggerGratification('REFORGED_BY_AI');
      }
    } finally {
      setSelectedIds([]);
      setIsProcessing(false);
    }
  };

  const handleApplyPalette = useCallback((colors: string[]) => {
    setEffects(prev => ({
      ...prev,
      duotone: true,
      duotoneColor1: colors[0],
      duotoneColor2: colors[1],
      outlineColor: colors[2] || prev.outlineColor,
      glowColor: colors[3] || prev.glowColor,
    }));
    triggerGratification('PALETTE_APPLIED');
  }, []);

  const handleImportPackToSmithy = useCallback(async (pack: GeneratedPackItem[]) => {
    setIsProcessing(true);
    const newFiles: ProcessedFile[] = [];
    for (const item of pack) {
      if (!item.blob || !item.previewUrl) continue;
      const id = crypto.randomUUID();
      const img = new Image();
      await new Promise(res => { img.onload = res; img.src = item.previewUrl!; });
      sourceCache.current.set(id, { id, image: img, rawUrl: item.previewUrl, fidelity: 100, label: item.label });
      
      newFiles.push({
        id, originalName: `${item.label}.png`, newName: `${item.label}.${exportFormat}`,
        blob: item.blob, previewUrl: item.previewUrl, status: 'completed', width: resolution,
        height: resolution, originalType: 'image/png', fidelityScore: 100, isAiGenerated: true
      });
    }
    setFiles(prev => [...newFiles, ...prev]);
    setMode('upscale');
    setIsProcessing(false);
    triggerGratification('PACK_IMPORT_OK');
  }, [resolution, exportFormat]);

  const handleDownloadZip = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      for (const file of files) {
        if (file.blob) {
          zip.file(file.newName, file.blob);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `icosmithy_export_${Date.now()}.zip`);
      triggerGratification('BATCH_EXPORTED');
    } catch (e) {
      setErrorInfo({ msg: "Export Error", fix: "Check if browser permits large downloads." });
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  const handleToggleSelect = useCallback((id: string, isShift: boolean) => {
    setSelectedIds(prev => {
      if (isShift && lastSelectedId) {
        const lastIdx = files.findIndex(f => f.id === lastSelectedId);
        const currentIdx = files.findIndex(f => f.id === id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          return Array.from(new Set([...prev, ...files.slice(start, end + 1).map(f => f.id)]));
        }
      }
      setLastSelectedId(id);
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    });
  }, [files, lastSelectedId]);

  return (
    <div className={`min-h-screen transition-all duration-300 flex flex-col items-center p-6 ${isDarkMode ? 'bg-[#121212] text-slate-100' : 'bg-slate-200 text-slate-900'}`}>
      {lastAction && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[3000] animate-success-pop">
          <div className="retro-panel bg-yellow-400 px-8 py-4 flex items-center gap-4 border-4">
            <Sparkles size={24} className="text-black animate-mosh-shake" />
            <span className="text-black font-black uppercase text-sm tracking-widest">{lastAction}</span>
          </div>
        </div>
      )}

      {errorInfo && (
        <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="retro-panel border-red-600 border-4 p-8 max-w-md animate-error-shake">
                <div className="flex items-center gap-4 mb-4 text-red-600"><AlertTriangle size={32} /><h2 className="text-xl font-black">FORGE FAILURE</h2></div>
                <div className="retro-inset p-4 bg-white mb-6 text-[10px] font-bold text-black">{errorInfo.fix}</div>
                <button onClick={() => setErrorInfo(null)} className="win-btn w-full bg-red-600 text-white">DISMISS</button>
            </div>
        </div>
      )}

      {/* Floating Toolbar Sidebar */}
      <div className="toolbox-container">
        {selectedIds.length > 0 && mode !== 'test' && toolboxOpen && (
          <div className="pointer-events-auto flex flex-col gap-4 animate-in slide-in-from-left-4">
            <ControlMatrix selectedIds={selectedIds} onAction={handleBulkAction} visible={true} onClose={() => setToolboxOpen(false)} />
            <PaletteForge onApplyPalette={handleApplyPalette} visible={true} onClose={() => setToolboxOpen(false)} />
          </div>
        )}
        {!toolboxOpen && selectedIds.length > 0 && (
          <button onClick={() => setToolboxOpen(true)} className="win-btn bg-indigo-600 text-white p-2 pointer-events-auto shadow-xl">
             <Hammer size={16} />
          </button>
        )}
      </div>

      <div className="w-full max-w-5xl space-y-6">
        <div className="flex justify-between items-center bg-black/10 p-4 rounded-lg">
            <Header />
            <div className="flex gap-2">
              {selectedIds.length > 0 && <button onClick={() => setSelectedIds([])} className="win-btn bg-red-700 text-white">CLEAR SELECTION ({selectedIds.length})</button>}
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="win-btn p-2">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            </div>
        </div>

        <nav className="flex justify-center gap-2">
            {[
              { id: 'upscale', label: 'THE SMITHY' },
              { id: 'cauldron', label: 'THE CAULDRON' },
              { id: 'test', label: 'FORGE PREVIEW' }
            ].map(m => (
                <button key={m.id} onClick={() => { setMode(m.id as any); setToolboxOpen(true); }} className={`win-btn flex-1 py-4 tracking-[0.2em] font-black ${mode === m.id ? 'bg-indigo-600 text-white shadow-none' : 'opacity-60'}`}>
                    {m.label}
                </button>
            ))}
        </nav>

        <section className="min-h-[600px] w-full">
            {mode === 'cauldron' ? (
                <Cauldron onPackGenerated={() => triggerGratification('PACK_GENERATED')} onImportToSmithy={handleImportPackToSmithy} onError={(msg, fix) => setErrorInfo({msg, fix})} />
            ) : mode === 'test' ? (
                <Desktop 
                  files={files} 
                  assignments={desktopAssignments} 
                  onAssign={(s, id) => setDesktopAssignments(prev => ({ ...prev, [s]: id }))} 
                  onTeleport={handleTeleport}
                  currentPerson={currentPerson}
                  isProcessing={isProcessing}
                />
            ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <EffectsPanel effects={effects} setEffects={setEffects} disabled={isProcessing} onUndo={()=>{}} canUndo={false} onError={(msg, fix) => setErrorInfo({msg, fix})} />
                    <Controls resolution={resolution} setResolution={setResolution} exportFormat={exportFormat} setExportFormat={setExportFormat} onDownload={handleDownloadZip} onReset={() => setFiles([])} isProcessing={isProcessing} canDownload={files.length > 0} />
                    <DropZone onFilesSelected={handleFilesSelected} />
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">STASHED_INVENTORY</h3>
                        <button onClick={() => setShowComparison(!showComparison)} className="win-btn text-[8px]">{showComparison ? "NORMAL_VIEW" : "COMPARISON_VIEW"}</button>
                    </div>
                    <Gallery files={files} comparisonMode={showComparison} sources={sourceCache.current} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} />
                </div>
            )}
        </section>
      </div>

      <StickerClipboard stickers={effects.customStickers} processedIcons={files.filter(f => f.status === 'completed')} onAddSticker={(u, i) => setEffects(prev => ({ ...prev, customStickers: [...prev.customStickers, { id: crypto.randomUUID(), url: u, x: 50, y: 50, scale: 30, rotation: 0, texture: 'none' }] }))} onRemoveSticker={id => setEffects(prev => ({ ...prev, customStickers: prev.customStickers.filter(s => s.id !== id) }))} onBatchApply={()=>{}} onGenerate={()=>{}} onApplyTexture={(id, tex) => setEffects(prev => ({ ...prev, customStickers: prev.customStickers.map(s => s.id === id ? { ...s, texture: tex } : s) }))} />
      <FloatingHelp onNav={p => setMode(p)} />
    </div>
  );
};

export default App;
