
import React from 'react';

interface SensorCardProps {
  label: string;
  value: number | string;
  unit: string;
  icon: React.ReactNode;
  colorClass: string;
  description: string;
  intensity?: number; 
  targetRange?: { min: number; max: number };
}

const SensorCard: React.FC<SensorCardProps> = ({ label, value, unit, icon, colorClass, description, intensity = 0, targetRange }) => {
  const isOutOfRange = targetRange && (typeof value === 'number') && (value < targetRange.min || value > targetRange.max);

  const glowStyle = (intensity > 70 || isOutOfRange) ? {
    boxShadow: `0 0 25px -5px ${isOutOfRange ? 'rgba(239, 68, 68, 0.4)' : label === 'Luminosity' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(124, 58, 237, 0.2)'}`
  } : {};

  return (
    <div 
      style={glowStyle}
      className={`bg-white p-6 rounded-[2rem] shadow-sm border transition-all duration-500 group relative overflow-hidden ${isOutOfRange ? 'border-red-100' : 'border-slate-100 hover:shadow-xl'}`}
    >
      <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-transform duration-1000 group-hover:scale-150 group-hover:-rotate-12`}>
        {icon}
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300 ${isOutOfRange ? 'bg-red-50 text-red-500' : colorClass}`}>
          {icon}
        </div>
        <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-1 relative z-10">
        <span className={`text-4xl font-black tracking-tighter ${isOutOfRange ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
        <span className="text-sm font-bold text-slate-400 uppercase">{unit}</span>
      </div>
      
      <div className="mt-4 space-y-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
            {targetRange && (
              <div 
                className="absolute h-full bg-slate-200/50 border-x border-slate-300/30"
                style={{ left: `${targetRange.min}%`, width: `${targetRange.max - targetRange.min}%` }}
              />
            )}
            <div 
              className={`h-full transition-all duration-1000 ${isOutOfRange ? 'bg-red-500' : intensity > 80 ? 'bg-violet-500' : intensity > 40 ? 'bg-violet-400' : 'bg-indigo-300'}`}
              style={{ width: `${Math.min(100, Math.max(0, intensity))}%` }}
            ></div>
          </div>
          <span className={`text-[10px] font-bold uppercase ${isOutOfRange ? 'text-red-500' : 'text-slate-300'}`}>
            {isOutOfRange ? 'Variance' : description}
          </span>
        </div>
        
        {targetRange && (
          <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest">
            <span>Ideal: {targetRange.min}{unit} - {targetRange.max}{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorCard;
