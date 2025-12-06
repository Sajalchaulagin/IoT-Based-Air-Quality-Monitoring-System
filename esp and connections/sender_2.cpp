#include <WiFi.h>
#include "Firebase_ESP_Client.h"
#include "DHT.h"
#include <NTPClient.h>
#include <WiFiUdp.h>

// ================== USER CONFIGURATION ==================
#define WIFI_SSID         "takshya"
#define WIFI_PASSWORD     "takshya01"

#define API_KEY           "AIzaSyDFb8wY6B_aJ-AM-ljmLMl-OH-0zX6dTMU"
#define DATABASE_URL      "https://airqualitymonitoringsyst-eb5af-default-rtdb.asia-southeast1.firebasedatabase.app/"

// Same dummy Firebase user (already created)
#define USER_EMAIL        "esp32@sensor.com"
#define USER_PASSWORD     "12345678"

// Paths for Dholakpur
const char* NODE_PATH     = "/data/dholakpur";
const char* HISTORY_PATH  = "/history/dholakpur";

// ================== SENSOR PINS ==================
#define DHTPIN            14     // DHT11 on GPIO14
#define MQ2_PIN           36     // Smoke / LPG sensor
#define MQ135_PIN         35     // Air Quality sensor

#define DHTTYPE           DHT11
DHT dht(DHTPIN, DHTTYPE);

// ================== OBJECTS ==================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 20700, 60000); // Nepal Time (+5:45)

// ================== CALIBRATION (adjust in clean air) ==================
float MQ2_BASE   = 1800;
float MQ135_BASE = 1600;

// Simple mapping function
float mapSensor(int raw, float base, float maxVal) {
  if (raw < base) {
    return map(raw, 0, (int)base, 0, (int)(maxVal * 0.1f));
  }
  return map(raw, (int)base, 4095, (int)(maxVal * 0.1f), (int)maxVal);
}

// ================== SETUP ==================
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  Serial.println(F("\n"
    "╔══════════════════════════════════════════╗\n"
    "║       DHOLAKPUR AIR QUALITY MONITOR      ║\n"
    "║           FULLY WORKING v2025            ║\n"
    "╚══════════════════════════════════════════╝\n"));

  dht.begin();

  // WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.println("IP: " + WiFi.localIP().toString());

  // NTP Time
  timeClient.begin();
  Serial.print("Syncing time");
  while (!timeClient.update()) {
    timeClient.forceUpdate();
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nTime synced: " + timeClient.getFormattedTime());

  // Firebase Auth (same dummy user)
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Logging in to Firebase...");
  int attempts = 0;
  while (auth.token.uid.length() == 0 && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (auth.token.uid.length() > 0) {
    Serial.println("\nFIREBASE LOGIN SUCCESS!");
    Serial.println("UID: " + String(auth.token.uid.c_str()));
  } else {
    Serial.println("\nFIREBASE LOGIN FAILED!");
    Serial.println("Check email/password and Firebase Auth settings!");
    while (true) delay(1000);
  }

  Serial.println("\nSystem ready! Starting uploads every 5 seconds...\n");
}

// ================== MAIN LOOP ==================
void loop() {
  static unsigned long lastUpload = 0;
  if (millis() - lastUpload < 5000) return;
  lastUpload = millis();

  timeClient.update();

  // Read DHT11
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed!");
    return;
  }
  float hi = dht.computeHeatIndex(t, h, false);

  // Read MQ sensors
  int raw_mq2   = analogRead(MQ2_PIN);
  int raw_mq135 = analogRead(MQ135_PIN);

  float smoke = mapSensor(raw_mq2,   MQ2_BASE,   2000);
  float aqi   = mapSensor(raw_mq135, MQ135_BASE,  500);

  // JSON payload
  FirebaseJson json;
  json.set("timestamp", timeClient.getEpochTime());
  json.set("time_str", timeClient.getFormattedTime());
  json.set("location", "Dholakpur");
  json.set("temp_c", roundf(t * 10) / 10.0);
  json.set("humidity_percent", roundf(h * 10) / 10.0);
  json.set("heat_index_c", roundf(hi * 10) / 10.0);
  json.set("smoke_ppm", smoke);
  json.set("aqi_index", aqi);
  // No CO field → dashboard already handles it as "Not Installed"

  // Serial output
  Serial.printf("Time: %s | T: %.1f°C | H: %.1f%% | AQI: %.0f | Smoke: %.0f\n",
                timeClient.getFormattedTime().c_str(), t, h, aqi, smoke);

  // Upload to Firebase
  if (Firebase.RTDB.pushJSON(&fbdo, HISTORY_PATH, &json)) {
    Firebase.RTDB.setJSON(&fbdo, NODE_PATH, &json);
    Serial.println("Uploaded successfully to Dholakpur!\n");
  } else {
    Serial.println("Upload failed: " + fbdo.errorReason());
  }
}