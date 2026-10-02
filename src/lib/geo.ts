import * as turf from '@turf/turf';
import { CapturedPoint, SurveyMetrics, SegmentDetail, PolygonDisplayMode } from '@/types/survey';

/**
 * Detects potential outlier points (accidental taps or GPS position spikes)
 * based on IQR (Interquartile Range) of distance from the centroid.
 */
export function detectOutlierPoints(points: CapturedPoint[]): string[] {
  const activePoints = points.filter((p) => !p.isExcluded);
  if (activePoints.length < 4) return [];

  try {
    const coords: [number, number][] = activePoints.map((p) => [p.lng, p.lat]);
    const featureCollection = turf.featureCollection(coords.map((c) => turf.point(c)));
    const center = turf.centroid(featureCollection);

    const distances = activePoints.map((p) => {
      const dist = turf.distance(center, turf.point([p.lng, p.lat]), { units: 'meters' });
      return { id: p.id, dist };
    });

    const sortedDists = [...distances].map((d) => d.dist).sort((a, b) => a - b);
    const q1 = sortedDists[Math.floor(sortedDists.length * 0.25)];
    const q3 = sortedDists[Math.floor(sortedDists.length * 0.75)];
    const iqr = q3 - q1;
    const upperBound = q3 + 2.2 * iqr;

    const outliers: string[] = [];
    distances.forEach((item) => {
      if (item.dist > upperBound && item.dist > 15) {
        outliers.push(item.id);
      }
    });

    return outliers;
  } catch (err) {
    console.warn('Outlier detection warning:', err);
    return [];
  }
}

/**
 * Re-orders irregular points radially around their geometric centroid
 * to fix self-intersecting criss-crossing lines automatically.
 */
export function autoUncrossPoints(points: CapturedPoint[]): CapturedPoint[] {
  if (points.length < 3) return [...points];

  try {
    const activePoints = points.filter((p) => !p.isExcluded);
    if (activePoints.length < 3) return [...points];

    const sumLat = activePoints.reduce((acc, p) => acc + p.lat, 0) / activePoints.length;
    const sumLng = activePoints.reduce((acc, p) => acc + p.lng, 0) / activePoints.length;

    const sorted = [...activePoints].sort((a, b) => {
      const angleA = Math.atan2(a.lat - sumLat, a.lng - sumLng);
      const angleB = Math.atan2(b.lat - sumLat, b.lng - sumLng);
      return angleA - angleB;
    });

    // Re-index point numbers
    return sorted.map((p, idx) => ({
      ...p,
      pointNumber: idx + 1,
    }));
  } catch (err) {
    return points;
  }
}

/**
 * Calculates Area, Perimeter, Segments, Kinks, and Closure Metrics
 * with robust unkinking for irregular non-rectangular polygons.
 */
export function calculateSurveyMetrics(
  rawPoints: CapturedPoint[],
  displayMode: PolygonDisplayMode = 'captured'
): SurveyMetrics | null {
  const activePoints = rawPoints.filter((p) => !p.isExcluded);
  if (activePoints.length < 3) {
    return null;
  }

  let processPoints = [...activePoints];
  if (displayMode === 'auto_uncross') {
    processPoints = autoUncrossPoints(activePoints);
  }

  try {
    // 1. Build coordinate array
    let coords: [number, number][] = processPoints.map((p) => [p.lng, p.lat]);

    // Handle Convex Hull mode if selected
    if (displayMode === 'convex_hull') {
      const pointsFc = turf.featureCollection(coords.map((c) => turf.point(c)));
      const hull = turf.convex(pointsFc);
      if (hull && hull.geometry.type === 'Polygon') {
        coords = hull.geometry.coordinates[0] as [number, number][];
      } else {
        coords.push([coords[0][0], coords[0][1]]);
      }
    } else {
      coords.push([coords[0][0], coords[0][1]]);
    }

    const poly = turf.polygon([coords]);

    // 2. Self-Intersection Kink Detection & Safe Area Calculation
    let hasKinks = false;
    let kinkCount = 0;
    let areaSqMeters = 0;

    try {
      const kinkFeatures = turf.kinks(poly);
      kinkCount = kinkFeatures.features.length;
      hasKinks = kinkCount > 0;
    } catch (kinkErr) {
      hasKinks = false;
    }

    if (hasKinks) {
      // Unkink self-intersecting irregular polygon into simple sub-polygons & sum areas
      const unkinked = turf.unkinkPolygon(poly);
      areaSqMeters = unkinked.features.reduce((sum, feat) => sum + turf.area(feat), 0);
    } else {
      areaSqMeters = turf.area(poly);
    }

    // Standard Land Metric Conversions
    const areaHectares = areaSqMeters / 10000;
    const areaAcres = areaSqMeters * 0.000247105;
    const areaSqFeet = areaSqMeters * 10.7639;
    const areaGuntha = areaSqMeters / 101.17; // 1 Guntha = 101.17 m²
    const areaBigha = areaSqMeters / 2529.3; // 1 Bigha ≈ 2529.3 m²

    // Perimeter calculation
    const line = turf.polygonToLine(poly);
    const perimeterKm = turf.length(line, { units: 'kilometers' });
    const perimeterMeters = perimeterKm * 1000;
    const perimeterFeet = perimeterMeters * 3.28084;

    // Centroid calculation
    const center = turf.centroid(poly);
    const [centroidLng, centroidLat] = center.geometry.coordinates;

    // Segment distances & bearings
    const segments: SegmentDetail[] = [];
    for (let i = 0; i < processPoints.length; i++) {
      const pCurrent = processPoints[i];
      const pNext = processPoints[(i + 1) % processPoints.length];
      const ptA = turf.point([pCurrent.lng, pCurrent.lat]);
      const ptB = turf.point([pNext.lng, pNext.lat]);

      const distM = turf.distance(ptA, ptB, { units: 'meters' });
      const bearing = (turf.bearing(ptA, ptB) + 360) % 360;

      segments.push({
        fromPointNumber: pCurrent.pointNumber,
        toPointNumber: pNext.pointNumber,
        lengthMeters: distM,
        lengthFeet: distM * 3.28084,
        bearingDegrees: bearing,
      });
    }

    // Closure Metrics (Distance from last point back to initial point #1)
    const firstPoint = processPoints[0];
    const lastPoint = processPoints[processPoints.length - 1];
    const ptStart = turf.point([firstPoint.lng, firstPoint.lat]);
    const ptEnd = turf.point([lastPoint.lng, lastPoint.lat]);
    const closureDistanceMeters = turf.distance(ptEnd, ptStart, { units: 'meters' });
    const closureBearingDegrees = (turf.bearing(ptEnd, ptStart) + 360) % 360;

    const outlierPointIds = detectOutlierPoints(rawPoints);

    return {
      areaSqMeters,
      areaHectares,
      areaAcres,
      areaSqFeet,
      areaGuntha,
      areaBigha,
      perimeterMeters,
      perimeterKm,
      perimeterFeet,
      pointCount: processPoints.length,
      centroid: { lat: centroidLat, lng: centroidLng },
      hasKinks,
      kinkCount,
      closureDistanceMeters,
      closureBearingDegrees,
      segments,
      outlierPointIds,
      isLoopClosed: closureDistanceMeters < 0.5,
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
 * Generates smooth B-Spline curve coordinates for irregular natural land boundaries
 */
export function getSmoothPolygonCoords(points: CapturedPoint[]): [number, number][] {
  const activePoints = points.filter((p) => !p.isExcluded);
  if (activePoints.length < 3) return activePoints.map((p) => [p.lat, p.lng]);

  try {
    const coords: [number, number][] = activePoints.map((p) => [p.lng, p.lat]);
    coords.push([coords[0][0], coords[0][1]]);

    const lineString = turf.lineString(coords);
    const curved = turf.bezierSpline(lineString, { resolution: 10000, sharpness: 0.85 });

    const smoothCoords = curved.geometry.coordinates.map(
      (c) => [c[1], c[0]] as [number, number]
    );

    return smoothCoords;
  } catch (err) {
    return activePoints.map((p) => [p.lat, p.lng]);
  }
}

/**
 * Export survey as standard GeoJSON feature collection
 */
export function exportToGeoJSON(points: CapturedPoint[], metrics: SurveyMetrics | null) {
  if (points.length === 0) return null;

  const features: any[] = [];
  const activePoints = points.filter((p) => !p.isExcluded);

  activePoints.forEach((p) => {
    features.push(
      turf.point([p.lng, p.lat], {
        pointNumber: p.pointNumber,
        timestamp: new Date(p.timestamp).toISOString(),
        accuracy: p.accuracy,
        elevation: p.elevation,
        isOutlier: p.isOutlier || false,
      })
    );
  });

  if (activePoints.length >= 3 && metrics) {
    const coords: [number, number][] = activePoints.map((p) => [p.lng, p.lat]);
    coords.push([activePoints[0].lng, activePoints[0].lat]);
    const poly = turf.polygon([coords], {
      name: 'Survey Boundary Parcel',
      areaSqMeters: metrics.areaSqMeters,
      areaAcres: metrics.areaAcres,
      areaHectares: metrics.areaHectares,
      perimeterMeters: metrics.perimeterMeters,
      closureDistanceMeters: metrics.closureDistanceMeters,
      hasKinks: metrics.hasKinks,
      createdAt: new Date().toISOString(),
    });
    features.push(poly);
  }

  return turf.featureCollection(features);
}

