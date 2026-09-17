export const DEFAULT_MQTT_CONFIG = {
  // HiveMQ Public WebSocket endpoints:
  // Port 8884 is WSS (SSL/TLS encrypted, works on HTTPS and HTTP)
  // Port 8000 is WS (unencrypted)
  brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
  fallbackUrl: 'ws://broker.hivemq.com:8000/mqtt',
  topic: 'geoverify/demo/zahid/location',
  clientIdPrefix: 'geoverify_survey_',
};

export interface MqttMessageCallback {
  (topic: string, message: Buffer): void;
}

export function parseTelemetryPayload(raw: string): any | null {
  try {
    const data = JSON.parse(raw);
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      return {
        lat: Number(data.lat),
        lng: Number(data.lng),
        accuracy: data.accuracy !== undefined ? Number(data.accuracy) : undefined,
        altitude: data.altitude !== undefined ? Number(data.altitude) : null,
        heading: data.heading !== undefined ? Number(data.heading) : null,
        speed: data.speed !== undefined ? Number(data.speed) : null,
        timestamp: data.timestamp || Date.now(),
        deviceId: data.deviceId || 'ROVER-01',
      };
    }
    return null;
  } catch (err) {
    console.error('Failed to parse MQTT telemetry JSON:', err);
    return null;
  }
}
