import * as turf from '@turf/turf';
import { CapturedPoint, SurveyMetrics } from '@/types/survey';

/**
 * Calculates Area and Perimeter from a list of captured points
 * using Turf.js. Note Turf expects coordinates in [longitude, latitude] order.
 */
export function calculateSurveyMetrics(points: CapturedPoint[]): SurveyMetrics | null {
  if (points.length < 3) {
    return null;
  }

  try {
    const coords: [number, number][] = points.map((p) => [p.lng, p.lat]);
    coords.push([points[0].lng, points[0].lat]);

    const poly = turf.polygon([coords]);

    const areaSqMeters = turf.area(poly);
    const areaHectares = areaSqMeters / 10000;
    const areaAcres = areaSqMeters * 0.000247105;
    const areaSqFeet = areaSqMeters * 10.7639;

    const line = turf.polygonToLine(poly);
    const perimeterKm = turf.length(line, { units: 'kilometers' });
    const perimeterMeters = perimeterKm * 1000;
    const perimeterFeet = perimeterMeters * 3.28084;

    const center = turf.centroid(poly);
    const [centroidLng, centroidLat] = center.geometry.coordinates;

    return {
      areaSqMeters,
      areaHectares,
      areaAcres,
      areaSqFeet,
      perimeterMeters,
      perimeterKm,
      perimeterFeet,
      pointCount: points.length,
      centroid: { lat: centroidLat, lng: centroidLng },
    };
  } catch (error) {
    console.error('Error calculating turf metrics:', error);
    return null;
  }
}

/**
 * Calculate distance between two points in meters using Turf
 */
export function calculateDistanceMeters(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  try {
    const from = turf.point([p1.lng, p1.lat]);
    const to = turf.point([p2.lng, p2.lat]);
    return turf.distance(from, to, { units: 'meters' });
  } catch (err) {
    return 0;
  }
}

/**
 * Formats a decimal degree to DMS (Degrees Minutes Seconds)
 */
export function formatDMS(deg: number, isLat: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

  const direction = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Export survey as standard GeoJSON feature
 */
export function exportToGeoJSON(points: CapturedPoint[], metrics: SurveyMetrics | null) {
  if (points.length === 0) return null;

  const features: any[] = [];

  points.forEach((p) => {
    features.push(
      turf.point([p.lng, p.lat], {
        pointNumber: p.pointNumber,
        timestamp: new Date(p.timestamp).toISOString(),
        accuracy: p.accuracy,
        elevation: p.elevation,
      })
    );
  });

  if (points.length >= 3 && metrics) {
    const coords: [number, number][] = points.map((p) => [p.lng, p.lat]);
    coords.push([points[0].lng, points[0].lat]);
    const poly = turf.polygon([coords], {
      name: 'Survey Boundary',
      areaSqMeters: metrics.areaSqMeters,
      areaAcres: metrics.areaAcres,
      perimeterMeters: metrics.perimeterMeters,
      createdAt: new Date().toISOString(),
    });
    features.push(poly);
  }

  return turf.featureCollection(features);
}
