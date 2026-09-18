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
  addressDetails?: {
    city?: string;
    state?: string;
    country?: string;
    road?: string;
    postcode?: string;
  };
}

export interface SurveyProject {
  id: string;
  title: string;
  clientName?: string;
  locationName?: string;
  notes?: string;
  points: CapturedPoint[];
  metrics: SurveyMetrics | null;
  createdAt: number;
  updatedAt: number;
  surveyorName?: string;
  surveyorEmail?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'lead_surveyor' | 'field_technician' | 'gis_analyst';
  organization?: string;
  isAuthenticated: boolean;
}

export interface AppSettings {
  locationSource: LocationSource;
  mqttBrokerUrl: string;
  mqttTopic: string;
  geocodingProvider: 'nominatim' | 'mapbox' | 'google';
  geocodingApiKey: string;
  firebaseEnabled: boolean;
  mapStyle: 'osm' | 'street' | 'topo' | 'satellite';
}
