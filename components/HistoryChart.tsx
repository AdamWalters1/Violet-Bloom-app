
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SensorData } from '../types';

interface HistoryChartProps {
  data: SensorData[];
}

const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">Vitals History</h3>
        <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> Humidity</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span> Temp</span>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f472b6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#f472b6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timestamp" 
              hide={true}
            />
            <YAxis hide={true} domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="humidity" 
              stroke="#7c3aed" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorHum)" 
            />
            <Area 
              type="monotone" 
              dataKey="temperature" 
              stroke="#f472b6" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorTemp)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HistoryChart;
