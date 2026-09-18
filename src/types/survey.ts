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
  address?: string;
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
  centroid?: { lat: number; lng: number };
}

export type MqttConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export type LocationSource = 'mqtt' | 'device' | 'emulator';

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

export interface GeocodedPlace {
  placeId: string;
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
  category?: string;
}

export interface AppSettings {
  locationSource: LocationSource;
  autoCaptureEnabled: boolean;
  autoCaptureDistance: number; // meters threshold
  mqttBrokerUrl: string;
  mqttTopic: string;
  mapStyle: 'osm' | 'street' | 'topo' | 'satellite';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'lead_surveyor' | 'field_technician' | 'gis_analyst';
  organization?: string;
  isAuthenticated: boolean;
}

export interface SurveyProject {
  id: string;
  title: string;
  clientName?: string;
  locationName?: string;
  points: CapturedPoint[];
  metrics: SurveyMetrics | null;
  createdAt: number;
  updatedAt: number;
}
