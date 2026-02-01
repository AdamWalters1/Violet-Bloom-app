
import { GoogleGenAI, Type } from "@google/genai";
import { PlantFact, SensorData, HealthReport, PlantRequirements } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getPlantFact = async (): Promise<PlantFact> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Tell me a fascinating and fun fact about plants or botany. It should be concise and interesting.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fact: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["fact", "category"],
        },
      },
    });
    const jsonStr = response.text || '{"fact": "Plants help maintain atmosphere.", "category": "General"}';
    return JSON.parse(jsonStr.trim());
  } catch (error) {
    return { fact: "Plants are vital for life.", category: "General" };
  }
};

export const getPlantRequirements = async (species: string): Promise<PlantRequirements> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide botanical care requirements for: ${species}. 
      Include wateringIntervalHours (the typical average hours between waterings for this specific indoor plant). 
      Snake Plants might be 240+ hours, while tropicals might be 48-72.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commonName: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            origin: { type: Type.STRING },
            careSummary: { type: Type.STRING },
            wateringIntervalHours: { type: Type.NUMBER, description: "Average hours between waterings" },
            idealTemp: {
              type: Type.OBJECT,
              properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
              required: ["min", "max"]
            },
            idealHumidity: {
              type: Type.OBJECT,
              properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
              required: ["min", "max"]
            },
            idealLight: {
              type: Type.OBJECT,
              properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
              required: ["min", "max"]
            }
          },
          required: ["commonName", "scientificName", "idealTemp", "idealHumidity", "idealLight", "careSummary", "wateringIntervalHours"],
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return {
      commonName: species,
      scientificName: "Unknown",
      origin: "Global",
      careSummary: "Maintain moderate conditions.",
      wateringIntervalHours: 72,
      idealTemp: { min: 18, max: 28 },
      idealHumidity: { min: 40, max: 60 },
      idealLight: { min: 30, max: 80 }
    };
  }
};

export const analyzePlantHealth = async (data: SensorData[], requirements?: PlantRequirements): Promise<HealthReport> => {
  const dataSummary = data.slice(-10).map(d => 
    `Time: ${d.timestamp}, AirHum: ${d.humidity}%, Temp: ${d.temperature}C, Light: ${d.lightLevel}`
  ).join("\n");

  const plantContext = requirements ? `The plant is a ${requirements.commonName}.` : '';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Act as a professional botanist. ${plantContext} Air humidity is for the environment, not soil. Analyze trends:\n${dataSummary}\nProvide a concise health summary.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "One sentence summary of plant health." },
            recommendation: { type: Type.STRING, description: "Actionable advice based on trends." },
            status: { type: Type.STRING, enum: ["optimal", "warning", "critical"] }
          },
          required: ["summary", "recommendation", "status"],
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return {
      summary: "Analyzing historical patterns...",
      recommendation: "Ensure consistent watering schedules.",
      status: "optimal"
    };
  }
};
