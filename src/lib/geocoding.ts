import { GeocodedPlace } from '@/types/survey';

/**
 * Perform forward geocoding: search for place names, cities, or addresses.
 * Uses free OpenStreetMap Nominatim by default (no API key required).
 */
export async function searchPlaces(
  query: string,
  apiKey?: string,
  provider: 'nominatim' | 'mapbox' | 'google' = 'nominatim'
): Promise<GeocodedPlace[]> {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();

  if (provider === 'nominatim' || !apiKey) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&limit=6&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'GeoVerify-WebGIS-LandSurveyApp/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim error ${response.status}`);
      }

      const data = await response.json();
      return data.map((item: any) => {
        const addr = item.address || {};
        const shortName =
          addr.road || addr.suburb || addr.city || addr.town || addr.village || item.display_name.split(',')[0];
        
        return {
          placeId: String(item.place_id),
          displayName: item.display_name,
          shortName,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          category: item.type || item.class,
          addressDetails: {
            city: addr.city || addr.town || addr.village,
            state: addr.state,
            country: addr.country,
            road: addr.road,
            postcode: addr.postcode,
          },
        };
      });
    } catch (err) {
      console.error('Failed to search places with Nominatim:', err);
      return [];
    }
  }

  // Mapbox Geocoding Provider
  if (provider === 'mapbox' && apiKey) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        trimmed
      )}.json?access_token=${apiKey}&limit=5`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.features) return [];
      return data.features.map((item: any) => ({
        placeId: item.id,
        displayName: item.place_name,
        shortName: item.text,
        lat: item.center[1],
        lng: item.center[0],
        category: item.place_type?.[0],
      }));
    } catch (err) {
      console.error('Failed to search places with Mapbox:', err);
      return [];
    }
  }

  return [];
}

/**
 * Reverse geocode latitude/longitude into human-readable place name
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey?: string,
  provider: 'nominatim' | 'mapbox' | 'google' = 'nominatim'
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'GeoVerify-WebGIS-LandSurveyApp/1.0',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.display_name) {
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.suburb || '';
      const area = addr.city || addr.town || addr.village || addr.county || '';
      const country = addr.country || '';
      const parts = [road, area, country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name;
    }
    return null;
  } catch (err) {
    console.error('Failed reverse geocoding:', err);
    return null;
  }
}
