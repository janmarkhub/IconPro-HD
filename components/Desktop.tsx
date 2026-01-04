
import React, { useState } from 'react';
import { 
  Monitor, Trash2, LayoutGrid, Settings, X, Search, Globe, User, 
  RefreshCw, Loader2, Folder, HardDrive, Network, UserCircle, Briefcase, Box, Zap 
} from 'lucide-react';
import { ProcessedFile, DesktopAssignments, PersonBio } from '../types';

interface DesktopProps {
  files: ProcessedFile[];
  assignments: DesktopAssignments;
  onAssign: (slot: keyof DesktopAssignments, fileId: string) => void;
  onTeleport: (name: string) => Promise<void>;
  currentPerson: PersonBio | null;
  isProcessing: boolean;
}

export const Desktop: React.FC<DesktopProps> = ({ files, assignments, onAssign, onTeleport, currentPerson, isProcessing }) => {
  const [isRecycleFull, setIsRecycleFull] = useState(false);
  const [activeModal, setActiveModal] = useState<'config' | 'visit' | null>(null);
  const [activeSlot, setActiveSlot] = useState<keyof DesktopAssignments | null>(null);
  const [searchPerson, setSearchPerson] = useState('');

  const getUrl = (fileId?: string, fallbackIcon?: React.ReactNode) => {
    const file = files.find(f => f.id === fileId);
    return file ? <img src={file.previewUrl} className="w-12 h-12 object-contain pixelated drop-shadow-md" /> : fallbackIcon;
  };

  const DesktopIcon = ({ slot, label, icon: Icon, pos }: { slot: keyof DesktopAssignments, label: string, icon: any, pos: string }) => (
    <div 
        className={`absolute flex flex-col items-center gap-1 w-20 p-2 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer group ${pos}`}
        onContextMenu={e => { e.preventDefault(); setActiveSlot(slot); setActiveModal('config'); }}
    >
        <div className="w-12 h-12 flex items-center justify-center transition-transform group-hover:scale-110">
            {slot === 'recycleBinEmpty' && isRecycleFull 
                ? getUrl(assignments.recycleBinFull, <Trash2 className="text-blue-300" size={32} />) 
                : getUrl(assignments[slot], <Icon className="text-white/80" size={32} />)}
        </div>
        <span className="text-[7px] text-white font-black drop-shadow-[1px_1px_2px_rgba(0,0,0,0.8)] uppercase text-center leading-tight">
            {label}
        </span>
    </div>
  );

  return (
    <div className="relative w-full aspect-video retro-panel overflow-hidden">
      <div className="absolute inset-0 transition-all duration-1000" style={{ 
          background: currentPerson 
            ? `linear-gradient(135deg, ${currentPerson.wallpaperColors[0] || '#1a1a1a'} 0%, ${currentPerson.wallpaperColors[1] || '#333'} 100%)` 
            : 'linear-gradient(135deg, #2c3e50 0%, #000 100%)',
          opacity: 0.8
      }} />
      
      {/* Grid of Icons */}
      <div className="absolute inset-0 p-4">
        <DesktopIcon slot="myPc" label="MY COMPUTER" icon={HardDrive} pos="top-4 left-4" />
        <DesktopIcon slot="recycleBinEmpty" label="TRASH" icon={Trash2} pos="top-24 left-4" />
        <DesktopIcon slot="controlPanel" label="SETTINGS" icon={Settings} pos="top-4 left-24" />
        <DesktopIcon slot="network" label="NETWORK" icon={Network} pos="top-24 left-24" />
        <DesktopIcon slot="account" label="IDENTITY" icon={UserCircle} pos="top-4 left-44" />
        <DesktopIcon slot="folder" label="STASH" icon={Folder} pos="top-24 left-44" />
        
        <DesktopIcon slot="extra1" label="ASSET_A" icon={Box} pos="top-4 left-64" />
        <DesktopIcon slot="extra2" label="ASSET_B" icon={Box} pos="top-24 left-64" />
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#c6c6c6] border-t-2 border-white flex items-center px-2 z-20 shadow-inner">
        <button className="win-btn flex items-center gap-1 border-indigo-400 bg-[#dfdfdf]">
          <LayoutGrid size={14}/> START
        </button>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-30 flex gap-2">
          <button onClick={() => setActiveModal('visit')} className="win-btn bg-indigo-600 text-white flex items-center gap-2 border-2 border-white shadow-xl hover:bg-indigo-500">
              <Globe size={14}/> VISIT PC
          </button>
      </div>

      {/* Person Bio */}
      {currentPerson && (
        <div className="absolute bottom-12 right-4 w-72 retro-panel p-5 animate-in slide-in-from-right-4 z-40 bg-black/80 border-2 border-indigo-400">
            <div className="flex justify-between items-center mb-3 border-b border-indigo-500 pb-1">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{currentPerson.name}</span>
                <button onClick={() => setActiveModal(null)} className="text-white hover:text-red-400 transition-colors"><X size={14}/></button>
            </div>
            <p className="text-[9px] text-white font-bold uppercase leading-relaxed tracking-tight">
                {currentPerson.knownFor}
            </p>
            <div className="mt-4 flex gap-2 overflow-hidden">
                {currentPerson.wallpaperColors.map(c => (
                    <div key={c} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                ))}
            </div>
        </div>
      )}

      {/* Warp Modal */}
      {activeModal === 'visit' && (
          <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <div className="retro-panel p-10 w-full max-w-sm flex flex-col gap-6 animate-mosh-shake">
                  <div className="flex items-center gap-3">
                      <Globe size={32} className="text-indigo-600"/>
                      <h3 className="text-2xl font-black uppercase tracking-tighter">WARP_INIT.EXE</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Search PC Owner:</label>
                    <input 
                        type="text" 
                        autoFocus
                        value={searchPerson} 
                        onChange={e=>setSearchPerson(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && onTeleport(searchPerson)}
                        placeholder="e.g. Master Chief" 
                        className="retro-inset w-full p-4 text-sm font-black uppercase outline-none bg-white text-black border-2 border-black" 
                    />
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => { onTeleport(searchPerson); setActiveModal(null); }} 
                        disabled={isProcessing}
                        className="win-btn flex-1 bg-indigo-600 text-white flex items-center justify-center gap-3 py-4"
                      >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18}/>} 
                        <span className="text-xs">LAUNCH</span>
                      </button>
                      <button onClick={()=>setActiveModal(null)} className="win-btn py-4">EXIT</button>
                  </div>
              </div>
          </div>
      )}

      {/* Slot Config Modal */}
      {activeModal === 'config' && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center backdrop-blur-sm">
            <div className="retro-panel p-8 w-full max-w-2xl max-h-[80%] flex flex-col gap-4">
                <div className="flex justify-between items-center border-b-2 border-black/10 pb-2">
                    <h3 className="text-xs font-black uppercase">REFORGE SLOT: {activeSlot}</h3>
                    <X size={20} className="cursor-pointer" onClick={()=>setActiveModal(null)}/>
                </div>
                <div className="grid grid-cols-6 gap-2 overflow-y-auto custom-scrollbar p-2 retro-inset bg-white">
                    {files.map(f => (
                        <div key={f.id} onClick={() => { onAssign(activeSlot!, f.id); setActiveModal(null); }} className="aspect-square bg-slate-100 hover:bg-indigo-50 border border-black/10 flex items-center justify-center cursor-pointer transition-all">
                            <img src={f.previewUrl} className="w-12 h-12 object-contain pixelated" />
                        </div>
                    ))}
                    {files.length === 0 && <p className="col-span-full text-center py-10 opacity-30 text-[8px] uppercase font-bold">INV_EMPTY</p>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
