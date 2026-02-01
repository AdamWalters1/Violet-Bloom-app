
export interface SensorData {
  humidity: number;
  temperature: number;
  lightLevel: number;
  timestamp: string;
  valve?: string;
}

export interface PlantFact {
  fact: string;
  category: string;
}

export interface PlantRequirements {
  commonName: string;
  scientificName: string;
  origin: string;
  idealTemp: { min: number; max: number };
  idealHumidity: { min: number; max: number };
  idealLight: { min: number; max: number };
  wateringIntervalHours: number;
  careSummary: string;
}

export interface HealthReport {
  summary: string;
  recommendation: string;
  status: 'optimal' | 'warning' | 'critical';
}

export interface BackendStatus {
  connected: boolean;
  isWatering: boolean;
  lastWatered: string | null;
  lastWateredDate: Date | null;
  valveStatus: string;
  wateringMode: 'manual' | 'autonomous';
}

export interface PlantMonitor {
  id: string;
  name: string;
  plantSpecies: string;
  location: string;
  type: string;
  image: string;
  isLive: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  payload: any;
  type?: 'info' | 'error' | 'success' | 'mock';
}
