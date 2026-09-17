# GeoVerify IoT Land Survey System 🛰️📐

A real-time IoT Land Surveying application built with Next.js (App Router), Leaflet WebGIS, Turf.js geospatial mathematics, and MQTT over WebSockets.

---

## 🌟 Architecture & Features

```
  +--------------------------+                         +---------------------------+
  |    Mobile GPS Rover      |                         |     WebGIS Dashboard      |
  |     Route: /emulator     |                         |         Route: /          |
  +--------------------------+                         +---------------------------+
               |                                                     ^
               | watchPosition() / Virtual Walk                      | Custom Rover Marker
               v                                                     | Dynamic Polygon
  +--------------------------------------------------------------------------------+
  |              Public MQTT Broker via WebSockets (broker.hivemq.com)             |
  |                   Topic: geoverify/demo/zahid/location                         |
  +--------------------------------------------------------------------------------+
```

### 1. The Mobile GPS Rover Emulator (`/emulator`)
- **Rugged Industrial GNSS UI**: Modeled after professional land surveying data collectors (Trimble / Leica / Topcon).
- **Dual GPS Engine**:
  - **Hardware GPS**: Uses `navigator.geolocation.watchPosition({ enableHighAccuracy: true })` for real outdoor field surveys.
  - **Virtual Field Simulator**: Includes interactive D-Pad (N/S/E/W step walk) and Auto-Patrol presets so you can test land surveying indoors or on desktop PCs without moving physically.
- **Real-Time Telemetry**: Latitude, Longitude, $\pm\text{Accuracy}$ in meters, Elevation, Speed, Heading, Packets transmitted counter, and timestamp.
- **MQTT Publisher**: Broadcasts JSON telemetry `{ lat, lng, accuracy, altitude, speed, heading, timestamp }` over WebSocket to `geoverify/demo/zahid/location`.

### 2. The WebGIS Dashboard (`/`)
- **Full-Screen Leaflet GIS Map**: Dynamically loaded (`next/dynamic` with `ssr: false`) to prevent SSR errors.
- **Live Rover Tracking**: Custom amber radar-pulsing marker that moves in real time with the rover.
- **Boundary Capture Engine**:
  - **"Capture Boundary Point" Button**: Records current live rover coordinates as numbered boundary vertices.
  - **Connecting Polyline**: Visual guide line connecting the last vertex to current live rover position.
  - **Dynamic Polygon Overlay**: Automatically closes the boundary polygon as vertices are added.
- **Geospatial Math Engine (`@turf/turf`)**:
  - Real-time **Area Calculation**: Square Meters ($m^2$), Hectares ($ha$), Acres ($ac$), and Square Feet ($ft^2$).
  - Real-time **Perimeter Calculation**: Meters ($m$), Kilometers ($km$), and Feet ($ft$).
- **Survey Management**:
  - Point deletion, undo point, and survey reset protection modal.
  - GeoJSON export & clipboard copy for GIS integration (QGIS, ArcGIS, Google Earth).
  - Map basemap switcher (CartoDB Dark Matter, OpenStreetMap, Esri World Imagery Satellite).

---

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the WebGIS Dashboard and [http://localhost:3000/emulator](http://localhost:3000/emulator) for the Mobile Rover Emulator.

### Production Build

```bash
npm run build
npm run start
```

---

## 📡 MQTT WebSocket Configuration

- **Broker URL**: `wss://broker.hivemq.com:8884/mqtt` (Secure WSS) / `ws://broker.hivemq.com:8000/mqtt`
- **Topic**: `geoverify/demo/zahid/location`
- **Format**: JSON
```json
{
  "lat": 37.774929,
  "lng": -122.419416,
  "accuracy": 0.85,
  "altitude": 48.0,
  "heading": 90,
  "speed": 1.2,
  "timestamp": 1726615400000,
  "deviceId": "GNSS-ROVER-PRO-X"
}
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) & React 18
- **Styling**: Tailwind CSS & Lucide React
- **Mapping**: Leaflet & React-Leaflet (Client Dynamic Import)
- **Geospatial Analytics**: `@turf/turf`
- **Communication Protocol**: MQTT.js over WebSockets
