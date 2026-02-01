
import React, { useState } from 'react';

interface ControlsProps {
  backendUrl: string;
  isThirsty: boolean;
  wateringMode: 'manual' | 'autonomous';
  lastWatered: string | null;
  hoursSince: number | null;
  onToggleMode: () => void;
  onWaterStart: () => void;
  onWaterEnd: (success: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({ 
  isThirsty, 
  wateringMode, 
  lastWatered,
  hoursSince,
  onToggleMode, 
  onWaterStart, 
  onWaterEnd 
}) => {
  const [loading, setLoading] = useState(false);
  
  const triggerWatering = async () => {
    setLoading(true);
    onWaterStart();
    setTimeout(() => {
      setLoading(false);
      onWaterEnd(true);
    }, 2000);
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center relative overflow-hidden">
      <div className="flex items-center justify-between w-full mb-10">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Nurture Hub</h3>
        <button 
          onClick={onToggleMode}
          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${wateringMode === 'autonomous' ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-100' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
        >
          {wateringMode === 'autonomous' ? 'Autonomous AI' : 'Manual Reminders'}
        </button>
      </div>
      
      <button
        onClick={triggerWatering}
        disabled={loading || (wateringMode === 'autonomous' && !isThirsty)}
        className={`
          group relative w-40 h-40 rounded-[3rem] flex items-center justify-center transition-all duration-500 transform active:scale-95
          ${loading 
            ? 'bg-violet-100 text-violet-500 shadow-inner'
            : isThirsty
              ? 'bg-violet-600 text-white shadow-2xl shadow-violet-300 animate-pulse'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-2xl shadow-violet-200 hover:-translate-y-2'
          }
          ${wateringMode === 'autonomous' && !loading && !isThirsty ? 'opacity-40 grayscale cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          <span className="text-xs font-black mt-3 tracking-[0.2em] uppercase">
            {loading ? 'Transmitting' : 'Irrigate'}
          </span>
        </div>
        
        {loading && (
          <div className="absolute inset-0 border-4 border-violet-500/20 border-t-violet-500 rounded-[3.1rem] animate-spin" />
        )}
      </button>

      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 mb-2">
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Last Hydrated:</span>
           <span className="text-xs font-bold text-violet-600">{lastWatered || 'Unknown'}</span>
        </div>
        {hoursSince !== null && (
          <div className="text-[9px] font-black px-3 py-1 bg-violet-50 text-violet-400 rounded-full uppercase tracking-tighter">
            {hoursSince.toFixed(1)} Hours Since Last Bloom
          </div>
        )}
        <p className="text-[10px] font-bold text-slate-300 text-center uppercase tracking-widest leading-relaxed max-w-[180px] mt-2">
          {wateringMode === 'autonomous' 
            ? 'Smart irrigation active based on time & climate stress.'
            : isThirsty 
              ? 'Soil likely parched based on species history.'
              : 'Plant rhythm is stable.'
          }
        </p>
      </div>
    </div>
  );
};

export default Controls;
