
# Green PlantIt: Smart Garden Ecosystem

Green PlantIt is a modern, original IoT solution for precision plant monitoring and irrigation. It bridges the gap between your physical garden and the digital world using ESP32 hardware, a Flask/MQTT backend, and AI-driven insights.

## 🌿 Core Concept

Unlike generic monitors, **Green PlantIt** treats every sensor node as a dedicated "PlantIt Node," allowing for a scalable hub-and-spoke architecture where you can manage multiple environmental stations from a single interface.

## 🛠️ Tech Stack

- **Dashboard**: React + TypeScript + Recharts.
- **Intelligence**: Google Gemini AI (`gemini-3-flash-preview`).
- **Communication**: MQTT (Mosquitto) for real-time ESP32 commands.
- **Backend**: Python Flask REST API.

## 🚀 Deployment

1. **Station Setup**: Pair your ESP32 with the `HackViolet/AdamW/sensors` topic.
2. **Backend**: Start `server.py` to bridge MQTT to the Web UI.
3. **Frontend**: Access the Green PlantIt Hub to see live data and trigger irrigation.

---
*Grow smarter with Green PlantIt.*
