
import React, { useState } from 'react';
import { 
  Scissors, Palette, RefreshCw, Wand2, Trash2, 
  HelpCircle, ChevronRight, MousePointer2, Target, X
} from 'lucide-react';
import { RetroTooltip } from './RetroTooltip';

interface ControlMatrixProps {
  selectedIds: string[];
  onAction: (action: string, payload?: any) => void;
  visible: boolean;
  onClose?: () => void;
}

export const ControlMatrix: React.FC<ControlMatrixProps> = ({ selectedIds, onAction, visible, onClose }) => {
  const [activeInput, setActiveInput] = useState<'style' | 'guide' | null>(null);
  const [inputValue, setInputValue] = useState('');

  if (!visible) return null;

  const handleApply = () => {
    onAction(activeInput === 'style' ? 'change-style' : 'guide-prompt', inputValue);
    setActiveInput(null);
    setInputValue('');
  };

  const ActionButton = ({ icon: Icon, label, onClick, color = "bg-[#555]", tooltipTitle, tooltipDesc }: any) => (
    <RetroTooltip title={tooltipTitle} description={tooltipDesc} position="right">
      <button 
        onClick={onClick}
        className={`group relative flex flex-col items-center justify-center w-full h-16 border-4 border-t-[#ffffff] border-l-[#ffffff] border-r-[#555555] border-b-[#555555] ${color} hover:brightness-110 transition-all active:scale-95 shadow-md`}
      >
        <Icon size={18} className="text-white group-hover:animate-mosh-shake" />
        <span className="text-[6px] font-black uppercase text-white mt-1 tracking-tighter">{label}</span>
      </button>
    </RetroTooltip>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-[#c6c6c6] border-8 border-t-[#ffffff] border-l-[#ffffff] border-r-[#555555] border-b-[#555555] p-2 shadow-2xl flex flex-col gap-2 relative w-24">
        
        {onClose && (
          <button onClick={onClose} className="absolute -top-3 -right-3 bg-red-600 text-white p-1 border-2 border-black rounded-full hover:bg-red-500 transition-colors shadow-lg z-50">
            <X size={10} />
          </button>
        )}

        <div className="absolute -top-10 left-0 w-full bg-indigo-600 text-white border-4 border-white px-2 py-1 text-[8px] font-black uppercase italic shadow-lg flex items-center justify-center gap-1">
            <MousePointer2 size={10}/> {selectedIds.length}
        </div>

        <ActionButton 
          icon={Scissors} label="Scrub BG" onClick={() => onAction('make-transparent')} 
          tooltipTitle="Alpha Scrub" tooltipDesc="Removes non-transparent background colors. Essential for newly generated icons."
        />
        <ActionButton 
          icon={Target} label="Recenter" onClick={() => onAction('center-icon')} color="bg-green-700"
          tooltipTitle="Smart Alignment" tooltipDesc="Snaps the icon content to the absolute grid center."
        />
        <ActionButton 
          icon={Palette} label="Restyle" onClick={() => setActiveInput('style')} color="bg-indigo-700" 
          tooltipTitle="Aesthetic Overhaul" tooltipDesc="Global AI restyling for selected items."
        />
        <ActionButton 
          icon={RefreshCw} label="Reroll" onClick={() => onAction('reroll')} 
          tooltipTitle="Divine Reroll" tooltipDesc="Regenerates versions of these items using metadata."
        />
        <ActionButton 
          icon={Trash2} label="Discard" onClick={() => onAction('delete')} color="bg-red-800" 
          tooltipTitle="Destroy Asset" tooltipDesc="Wipes items from inventory."
        />
      </div>

      {activeInput && (
        <div className="fixed left-32 top-1/2 -translate-y-1/2 w-80 bg-[#c6c6c6] border-8 border-t-[#ffffff] border-l-[#ffffff] border-r-[#555555] border-b-[#555555] p-6 shadow-2xl animate-in slide-in-from-left-4 duration-300">
             <div className="flex items-center justify-between mb-4 border-b-2 border-black/10 pb-2">
                <h4 className="text-[10px] font-black uppercase flex items-center gap-3">
                    {activeInput === 'style' ? <Palette size={16}/> : <Wand2 size={16}/>} 
                    Forge Focus
                </h4>
                <button onClick={() => setActiveInput(null)} className="hover:text-red-600"><ChevronRight size={20}/></button>
             </div>
             <textarea 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={activeInput === 'style' ? 'e.g. 16-bit Sega Genesis style...' : 'e.g. Add a glowing effect...'}
                className="w-full h-24 bg-black/10 border-4 border-[#555] p-4 text-[10px] text-black font-bold uppercase outline-none focus:bg-white transition-all resize-none"
             />
             <button 
                onClick={handleApply}
                className="w-full mt-4 py-4 bg-indigo-600 border-4 border-white text-white text-[10px] font-black uppercase hover:bg-indigo-500 shadow-xl active:scale-95"
             >
                Reforge {selectedIds.length} Assets
             </button>
        </div>
      )}
    </div>
  );
};
