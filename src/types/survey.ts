export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy?: number; // in meters
  altitude?: number | null; // in meters
  heading?: number | null; // in degrees
  speed?: number | null; // in m/s
  timestamp: number; // epoch ms
}

export interface CapturedPoint {
  id: string;
  pointNumber: number;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
  elevation?: number | null;
}

export interface SurveyMetrics {
  areaSqMeters: number;
  areaHectares: number;
  areaAcres: number;
  areaSqFeet: number;
  perimeterMeters: number;
  perimeterKm: number;
  perimeterFeet: number;
  pointCount: number;
}

export type MqttConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface TelemetryPayload {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  deviceId?: string;
}
