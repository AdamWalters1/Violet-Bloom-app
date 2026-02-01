#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <DHT.h> 

// --- HARDWARE PIN DEFINITIONS ---
const int BUTTON_PIN = 12;      // Digital Input (Manual Override)
const int SERVO_PIN = 13;       // Servo Signal
const int DHT_PIN = 14;         // Temp/Hum Sensor (Digital)
const int SOIL_PIN = 34;        // Analog Soil Sensor
const int LIGHT_PIN = 35;       // Analog Light Sensor

// --- SENSOR SETTINGS ---
#define DHTTYPE DHT11           
DHT dht(DHT_PIN, DHTTYPE);

// --- WI-FI & MQTT SETTINGS ---
const char* ssid = "iPhone (7)";
const char* password = "by6ki599uqs4e";
const char* mqtt_server = "test.mosquitto.org"; 
const int mqtt_port = 1883;

// --- MQTT TOPICS ---
// MAKE SURE THESE MATCH YOUR FRIEND'S PYTHON SCRIPT EXACTLY
const char* topic_sensor_data = "HackViolet/AdamW/sensors";
const char* topic_commands = "HackViolet/AdamW/commands";

// --- SERVO SETTINGS ---
const int POS_OPEN = 90; 
const int POS_CLOSE = 0; 
bool isValveOpen = false;

// --- SYSTEM CONSTANTS ---
// const int MOISTURE_THRESHOLD = 2000; // Disabled for manual mode
const unsigned long WATERING_TIME = 5000;
const unsigned long CHECK_INTERVAL = 10000; // Send data every 10s

// --- GLOBAL OBJECTS ---
WiFiClient espClient;
PubSubClient client(espClient);
Servo valveServo;

// --- STATE MACHINE ---
enum SystemState { IDLE, WATERING };
SystemState currentState = IDLE;

unsigned long lastCheckTime = 0;
unsigned long wateringStartTime = 0;

// Button Debouncing
int lastButtonState = HIGH; 
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;

// --- FUNCTION PROTOTYPES ---
void setup_wifi();
void reconnect();
void callback(char* topic, byte* payload, unsigned int length);
void toggleValve();
void checkSensors();
void startWatering();
void stopWatering();

void setup() {
  Serial.begin(9600); // Back to standard speed

  // 1. Hardware Init
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Servo Init
  valveServo.setPeriodHertz(50);
  valveServo.attach(SERVO_PIN, 500, 2400);
  valveServo.write(POS_CLOSE);

  // DHT Init
  dht.begin();

  // 2. Network Init
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); 

  // --- BUTTON LOGIC ---
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading == LOW) { // Button Pressed
      Serial.println("Button Pressed!");
      toggleValve();
      delay(300); 
    }
  }
  lastButtonState = reading;

  // --- MAIN STATE MACHINE ---
  unsigned long currentTime = millis();

  switch (currentState) {
    case IDLE:
      if (currentTime - lastCheckTime >= CHECK_INTERVAL) {
        lastCheckTime = currentTime;
        checkSensors();
      }
      break;

    case WATERING:
      if (currentTime - wateringStartTime >= WATERING_TIME) {
        stopWatering();
      }
      break;
  }
}

// --- LOGIC FUNCTIONS ---

void checkSensors() {
  // 1. Read All Sensors
  int soilValue = analogRead(SOIL_PIN);
  int lightValue = analogRead(LIGHT_PIN); 
  float temp = dht.readTemperature();     
  float hum = dht.readHumidity();         

  // Check if DHT read failed
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Failed to read from DHT sensor!");
    temp = 0.0;
    hum = 0.0;
  }

  // 2. Format JSON Payload
  String payload = "{\"light\": " + String(lightValue) + 
                   ", \"temp\": " + String(temp) + 
                   ", \"hum\": " + String(hum) + 
                   ", \"valve\": \"" + (isValveOpen ? "OPEN" : "CLOSED") + "\"}";

  Serial.print("Publishing: "); Serial.println(payload);
  client.publish(topic_sensor_data, payload.c_str());

  // --- DISABLED AUTOMATIC WATERING ---
  // if (soilValue < MOISTURE_THRESHOLD && currentState != WATERING) {
  //   startWatering();
  // }
}

void toggleValve() {
  if (isValveOpen) {
    valveServo.write(POS_CLOSE);
    isValveOpen = false;
    currentState = IDLE;
    client.publish(topic_sensor_data, "{\"status\": \"VALVE_CLOSED\"}");
  } else {
    valveServo.write(POS_OPEN);
    isValveOpen = true;
    currentState = WATERING; 
    wateringStartTime = millis(); 
    client.publish(topic_sensor_data, "{\"status\": \"VALVE_OPEN\"}");
  }
}

void startWatering() {
  Serial.println("CMD: Watering Plant");
  valveServo.write(POS_CLOSE);
  isValveOpen = true;
  wateringStartTime = millis();
  currentState = WATERING;
  client.publish(topic_sensor_data, "{\"status\": \"WATERING\"}");
}

void stopWatering() {
  Serial.println("CMD: Done Watering");
  valveServo.write(POS_OPEN);
  isValveOpen = false;
  currentState = IDLE;
  client.publish(topic_sensor_data, "{\"status\": \"IDLE\"}");
}

// --- NETWORK HELPERS ---
void setup_wifi() {
  delay(10);
  Serial.print("Connecting to "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      // Subscribe to commands topic
      client.subscribe(topic_commands);
    } else {
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  Serial.print("Message arrived: "); Serial.println(message);

  // TRIGGER ON SPECIFIC COMMAND
  if (message == "WATER_NOW") {
    startWatering();
  }
}