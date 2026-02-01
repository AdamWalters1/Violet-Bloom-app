
import json
import time
import threading
import random
from flask import Flask, jsonify, request
from flask_cors import CORS
import paho.mqtt.client as mqtt

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
MQTT_BROKER = "test.mosquitto.org"
MQTT_TOPIC_DATA = "HackViolet/AdamW/sensors"
MQTT_TOPIC_CMD = "HackViolet/AdamW/commands"

# Internal state to store latest data from ESP32
# Now tracking light, temp, humidity, and valve as requested.
latest_hardware_data = {
    "humidity": 0,
    "temperature": 0,
    "light": 0,
    "valve": "closed",
    "last_update": None
}

# --- MQTT CALLBACKS ---
def on_connect(client, userdata, flags, rc):
    print(f"✅ Connected to MQTT Broker! Subscribed to: {MQTT_TOPIC_DATA}")
    client.subscribe(MQTT_TOPIC_DATA)

def on_message(client, userdata, msg):
    global latest_hardware_data
    try:
        payload = msg.payload.decode("utf-8")
        data = json.loads(payload)
        
        # Update our global state with real values from the ESP32 payload keys:
        # light, temp, humidity, and valve
        latest_hardware_data["humidity"] = data.get('humidity', 0)
        latest_hardware_data["temperature"] = data.get('temp', 0)
        latest_hardware_data["light"] = data.get('light', 0)
        latest_hardware_data["valve"] = data.get('valve', 'closed')
        latest_hardware_data["last_update"] = time.strftime("%H:%M:%S")
        
        print(f"Update: H:{latest_hardware_data['humidity']} T:{latest_hardware_data['temperature']} L:{latest_hardware_data['light']} V:{latest_hardware_data['valve']}")
        
    except Exception as e:
        print(f"❌ Error parsing MQTT message: {e}")

# --- SETUP MQTT CLIENT ---
mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

def run_mqtt():
    try:
        mqtt_client.connect(MQTT_BROKER, 1883, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        print(f"❌ MQTT Connection failed: {e}")

# Start MQTT thread
mqtt_thread = threading.Thread(target=run_mqtt, daemon=True)
mqtt_thread.start()

# --- FLASK ROUTES ---
@app.route('/sensors', methods=['GET'])
def get_sensors():
    """Returns the latest data received from MQTT."""
    return jsonify({
        "humidity": latest_hardware_data["humidity"],
        "temperature": latest_hardware_data["temperature"],
        "lightLevel": latest_hardware_data["light"],
        "valve": latest_hardware_data["valve"],
        "timestamp": latest_hardware_data["last_update"] or time.strftime("%H:%M:%S")
    })

@app.route('/water', methods=['POST'])
def trigger_water():
    """Publishes a watering command to the MQTT broker."""
    print(f"🌊 Web UI requested WATER_NOW. Publishing to {MQTT_TOPIC_CMD}")
    
    # Send the command to your ESP32
    result = mqtt_client.publish(MQTT_TOPIC_CMD, "WATER_NOW")
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        return jsonify({
            "status": "success",
            "message": "Watering command transmitted",
            "timestamp": time.strftime("%H:%M:%S")
        })
    else:
        return jsonify({"status": "error", "message": "Failed to publish to MQTT"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
