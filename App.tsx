
import React, { useState, useEffect, useMemo, useRef } from 'react';
import mqtt from 'mqtt';
import { SensorData, PlantFact, BackendStatus, PlantMonitor, HealthReport, PlantRequirements, LogEntry } from './types';
import { getPlantFact, analyzePlantHealth, getPlantRequirements } from './services/geminiService';
import SensorCard from './components/SensorCard';
import Controls from './components/Controls';
import HistoryChart from './components/HistoryChart';

const MONITORS: PlantMonitor[] = [
  {
    id: 'alpha',
    name: 'Bloom Node Alpha',
    plantSpecies: 'Snake Plant',
    location: 'Main Conservatory',
    type: 'ESP32 MQTT Station',
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=400',
    isLive: true
  },
  {
    id: 'beta-demo',
    name: 'Flora Hub 1',
    plantSpecies: 'Bird of Paradise',
    location: 'Atrium East',
    type: 'Virtual Node',
    image: 'https://images.unsplash.com/photo-1446071103084-c257b5f70672?auto=format&fit=crop&q=80&w=400',
    isLive: false
  }
];

const MQTT_CONFIG = {
  broker: 'wss://test.mosquitto.org:8081',
  topicData: 'HackViolet/AdamW/sensors',
  topicCmd: 'HackViolet/AdamW/commands'
};

const HumidityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
);
const TempIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
);
const LightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);

const App: React.FC = () => {
  const [activeMonitorId, setActiveMonitorId] = useState<string | null>(null);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [rawLogs, setRawLogs] = useState<LogEntry[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [currentFact, setCurrentFact] = useState<PlantFact | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [plantReqs, setPlantReqs] = useState<PlantRequirements | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    isWatering: false,
    lastWatered: 'Never',
    lastWateredDate: null,
    valveStatus: 'closed',
    wateringMode: 'manual'
  });

  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const autoWaterCooldownRef = useRef<number>(0);

  useEffect(() => {
    getPlantFact().then(setCurrentFact);
  }, []);

  useEffect(() => {
    const activeMonitor = MONITORS.find(m => m.id === activeMonitorId);
    if (activeMonitor) {
      setPlantReqs(null);
      setSensorData([]);
      getPlantRequirements(activeMonitor.plantSpecies).then(setPlantReqs);
    }
  }, [activeMonitorId]);

  useEffect(() => {
    if (showConsole) consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawLogs, showConsole]);

  const latest: SensorData = useMemo(() => {
    const last = sensorData[sensorData.length - 1];
    return {
      humidity: last?.humidity ?? 0,
      temperature: last?.temperature ?? 0,
      lightLevel: last?.lightLevel ?? 0,
      timestamp: last?.timestamp ?? '--:--:--'
    };
  }, [sensorData]);

  const thirstInfo = useMemo(() => {
    if (!plantReqs) return { isThirsty: false, reason: '', stress: 0, hoursSince: null };
    
    const hoursSince = backendStatus.lastWateredDate 
      ? (Date.now() - backendStatus.lastWateredDate.getTime()) / (1000 * 60 * 60)
      : 9999; 

    let multiplier = 1.0;
    if (latest.temperature > 28) multiplier -= 0.2; 
    if (latest.lightLevel > 80) multiplier -= 0.1;  
    if (latest.humidity < 30) multiplier -= 0.1;    

    const adjustedInterval = (plantReqs.wateringIntervalHours || 72) * Math.max(0.5, multiplier);
    const isThirsty = hoursSince > adjustedInterval;

    let reason = '';
    if (isThirsty) {
      if (hoursSince > (plantReqs.wateringIntervalHours || 72)) reason = 'Interval threshold reached.';
      else reason = 'High transpiration stress detected.';
    }

    return { 
      isThirsty, 
      reason, 
      hoursSince: hoursSince === 9999 ? null : hoursSince,
      stress: 1 - multiplier 
    };
  }, [latest, plantReqs, backendStatus.lastWateredDate]);

  useEffect(() => {
    if (thirstInfo.isThirsty && backendStatus.wateringMode === 'autonomous' && !backendStatus.isWatering) {
      const now = Date.now();
      if (now - autoWaterCooldownRef.current > 30000) {
        autoWaterCooldownRef.current = now;
        triggerWateringSequence();
      }
    }
  }, [thirstInfo.isThirsty, backendStatus.wateringMode]);

  const triggerWateringSequence = () => {
    setBackendStatus(p => ({ ...p, isWatering: true }));
    const now = new Date();
    
    if (isSimulated) {
      setTimeout(() => {
        setBackendStatus(p => ({ 
          ...p, 
          isWatering: false, 
          valveStatus: 'closed', 
          lastWatered: now.toLocaleTimeString(),
          lastWateredDate: now
        }));
      }, 4000);
    } else {
      if (mqttClientRef.current?.connected) {
        mqttClientRef.current.publish(MQTT_CONFIG.topicCmd, "WATER_NOW");
      }
    }
  };

  const triggerAIAnalysis = async () => {
    if (sensorData.length < 3) return;
    setIsAnalyzing(true);
    try {
      const report = await analyzePlantHealth(sensorData, plantReqs || undefined);
      setHealthReport(report);
    } catch (error) {
      console.error("Health analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isSimulated) {
      const interval = setInterval(() => {
        const lastVal = sensorData[sensorData.length - 1] || { humidity: 55, temperature: 22, lightLevel: 75 };
        const next = {
          humidity: Math.max(0, Math.min(100, lastVal.humidity + (Math.random() - 0.5) * 4)),
          temperature: Math.max(15, Math.min(35, lastVal.temperature + (Math.random() - 0.5) * 0.5)),
          lightLevel: Math.max(0, Math.min(100, lastVal.lightLevel + (Math.random() - 0.5) * 10)),
          timestamp: new Date().toLocaleTimeString(),
          valve: backendStatus.valveStatus
        };
        setSensorData(prev => [...prev, next].slice(-30));
        setBackendStatus(prev => ({ ...prev, connected: true }));
      }, 4000);
      return () => clearInterval(interval);
    }

    const client = mqtt.connect(MQTT_CONFIG.broker, {
      clientId: `violet_bloom_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 1000,
    });

    client.on('connect', () => {
      setBackendStatus(prev => ({ ...prev, connected: true }));
      client.subscribe(MQTT_CONFIG.topicData);
    });

    client.on('message', (topic, message) => {
      if (topic === MQTT_CONFIG.topicData) {
        try {
          const data = JSON.parse(message.toString());
          const next: SensorData = {
            humidity: Number(data.humidity ?? data.hum ?? 0),
            temperature: Number(data.temperature ?? data.temp ?? 0),
            lightLevel: Math.max(0, Math.min(100, (1 - (Number(data.light ?? 4095) / 4095)) * 100)),
            valve: data.valve ?? 'closed',
            timestamp: new Date().toLocaleTimeString()
          };

          setSensorData(prev => [...prev, next].slice(-30));
          setBackendStatus(prev => ({ 
            ...prev, 
            valveStatus: next.valve || 'closed',
            ...(next.valve === 'open' && prev.valveStatus === 'closed' ? { 
              lastWateredDate: new Date(), 
              lastWatered: new Date().toLocaleTimeString() 
            } : {})
          }));
        } catch (err) { console.error(err); }
      }
    });

    mqttClientRef.current = client;
    return () => { client.end(); };
  }, [isSimulated]);

  const NodeConsole = () => (
    <div className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 transition-all duration-500 z-[60] overflow-hidden ${showConsole ? 'h-72' : 'h-0'}`}>
       <div className="max-w-7xl mx-auto h-full flex flex-col">
         <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${backendStatus.connected ? 'bg-violet-500 animate-pulse' : 'bg-red-500'}`}></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {isSimulated ? 'Mock Data Stream' : `Bloom Protocol: ${MQTT_CONFIG.broker}`}
               </span>
            </div>
            <button onClick={() => setShowConsole(false)} className="text-slate-500 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
         </div>
         <div className="flex-1 overflow-y-auto font-mono text-[10px] p-6 space-y-2 scrollbar-hide bg-black/20 text-slate-300">
            Awaiting frames on {MQTT_CONFIG.topicData}...
         </div>
       </div>
    </div>
  );

  const HomeView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="animate-in fade-in slide-in-from-left-4 duration-1000">
          <h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter mb-6 leading-none">
            Welcome to <br/><span className="text-violet-600">Violet Bloom</span>
          </h2>
          <div className="flex items-center gap-4 mb-8">
            <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${backendStatus.connected ? 'bg-violet-50 text-violet-600' : 'bg-red-50 text-red-600'}`}>
              Network Status: {backendStatus.connected ? 'Active' : 'Offline'}
            </div>
          </div>
        </div>

        {currentFact && (
          <div className="relative overflow-hidden bg-white p-10 rounded-[3rem] shadow-xl shadow-violet-100 border border-slate-100 group animate-in fade-in slide-in-from-right-4 duration-1000">
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <div className="h-1 w-6 rounded-full bg-violet-500"></div>
                   <span className="text-[10px] font-black uppercase text-violet-600 tracking-widest">Botany Insight</span>
                </div>
                <h3 className="text-slate-800 text-2xl font-semibold leading-snug italic">
                  "{currentFact.fact}"
                </h3>
                <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">— {currentFact.category}</p>
             </div>
          </div>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-6">
          <h3 className="text-xl font-extrabold text-slate-800">Deployment Grid</h3>
          <button onClick={() => setIsSimulated(!isSimulated)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${isSimulated ? 'bg-violet-600 text-white border-violet-500' : 'bg-white text-slate-400'}`}>
            {isSimulated ? 'Sandbox Enabled' : 'Live Mode'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {MONITORS.map((monitor) => (
            <div 
              key={monitor.id}
              onClick={() => setActiveMonitorId(monitor.id)}
              className="group cursor-pointer bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
            >
              <div className="h-64 relative overflow-hidden">
                <img src={monitor.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-6 left-8">
                   <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">{monitor.plantSpecies}</p>
                   <h4 className="text-2xl font-black text-white tracking-tight">{monitor.name}</h4>
                </div>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monitor.type}</span>
                  <div className={`w-3 h-3 rounded-full ${monitor.isLive || isSimulated ? 'bg-violet-500 animate-pulse' : 'bg-slate-200'}`}></div>
                </div>
                <p className="text-xs font-bold text-slate-400 italic">{monitor.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const DashboardView = () => {
    const monitor = MONITORS.find(m => m.id === activeMonitorId);
    if (!monitor) return null;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-in fade-in duration-700">
        {thirstInfo.isThirsty && backendStatus.wateringMode === 'manual' && (
          <div className="mb-8 p-6 bg-violet-600 rounded-[2.5rem] shadow-2xl shadow-violet-200 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white text-3xl animate-bounce">💜</div>
                <div>
                   <h4 className="text-white font-black text-xl tracking-tight">Thirst Alert: {monitor.plantSpecies}</h4>
                   <p className="text-violet-100 text-sm font-medium">{thirstInfo.reason} It's been {thirstInfo.hoursSince?.toFixed(1) ?? '--'} hours.</p>
                </div>
             </div>
             <button onClick={triggerWateringSequence} className="px-10 py-4 bg-white text-violet-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-transform">Irrigate Now</button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="space-y-4">
            <button onClick={() => setActiveMonitorId(null)} className="flex items-center gap-2 text-[10px] font-black text-violet-600 uppercase tracking-[0.3em] hover:translate-x-[-4px] transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m15 18-6-6 6-6"/></svg> Back to Network
            </button>
            <div className="flex items-center gap-4">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{monitor.name}</h2>
              {thirstInfo.stress > 0.2 && (
                <div className="px-3 py-1.5 bg-pink-100 border border-pink-200 rounded-full flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-pink-500 animate-ping"></div>
                   <span className="text-[8px] font-black text-pink-600 uppercase tracking-widest">Stress Detected</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={() => setShowConsole(!showConsole)} className={`px-6 py-4 rounded-2xl border-2 transition-all ${showConsole ? 'bg-slate-900 text-white border-slate-700' : 'bg-white border-slate-100'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">Telemetry</span>
             </button>
             <button onClick={triggerAIAnalysis} disabled={isAnalyzing || sensorData.length < 3} className="px-6 py-4 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest hover:shadow-xl transition-all">
                {isAnalyzing ? 'Scanning...' : 'AI Health Check'}
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SensorCard label="Air Hum" value={latest.humidity.toFixed(1)} unit="%" icon={<HumidityIcon />} colorClass="bg-violet-50 text-violet-500" description="Atmo" intensity={latest.humidity} targetRange={plantReqs?.idealHumidity} />
              <SensorCard label="Temp" value={latest.temperature.toFixed(1)} unit="°C" icon={<TempIcon />} colorClass="bg-pink-50 text-pink-500" description="Air" intensity={(latest.temperature / 40) * 100} targetRange={plantReqs?.idealTemp} />
              <SensorCard label="Light" value={latest.lightLevel.toFixed(1)} unit="%" icon={<LightIcon />} colorClass="bg-amber-50 text-amber-600" description="Lux" intensity={latest.lightLevel} targetRange={plantReqs?.idealLight} />
            </div>
            
            <HistoryChart data={sensorData} />

            {healthReport && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-violet-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${healthReport.status === 'optimal' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Botanist Diagnosis</h3>
                </div>
                <p className="text-slate-600 font-medium mb-4">{healthReport.summary}</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Recommendation</p>
                  <p className="text-xs text-slate-700 leading-relaxed font-bold">{healthReport.recommendation}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-8">
            <Controls 
              backendUrl={isSimulated ? "MOCK" : "MQTT"} 
              isThirsty={thirstInfo.isThirsty}
              wateringMode={backendStatus.wateringMode}
              lastWatered={backendStatus.lastWatered}
              hoursSince={thirstInfo.hoursSince}
              onToggleMode={() => setBackendStatus(p => ({ ...p, wateringMode: p.wateringMode === 'manual' ? 'autonomous' : 'manual' }))}
              onWaterStart={triggerWateringSequence}
              onWaterEnd={() => setBackendStatus(p => ({ ...p, isWatering: false }))}
            />
            
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Bio Log</h3>
               <div className="space-y-4">
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span className="uppercase tracking-widest">Target:</span>
                    <span className="text-violet-600">{monitor.plantSpecies}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span className="uppercase tracking-widest">Frequency:</span>
                    <span>{plantReqs?.wateringIntervalHours ?? '--'}h</span>
                 </div>
                 <div className="pt-4 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 italic leading-relaxed">{plantReqs?.careSummary}</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12 selection:bg-violet-100 selection:text-violet-900">
      <header className="bg-white/90 backdrop-blur-2xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-5 cursor-pointer" onClick={() => setActiveMonitorId(null)}>
            <div className="bg-violet-600 p-4 rounded-[1.5rem] shadow-lg shadow-violet-200 flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M12 2L4.5 9.22A5 5 0 0 0 3 13.07V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6.93a5 5 0 0 0-1.5-3.85L12 2z"/><circle cx="12" cy="15" r="3"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Violet <span className="text-violet-600">Bloom</span></h1>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Artisan Botany Hub</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{activeMonitorId ? <DashboardView /> : <HomeView />}</main>
      <NodeConsole />
    </div>
  );
};

export default App;
