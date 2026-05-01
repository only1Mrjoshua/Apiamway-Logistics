import { makeRequest } from "./_core/map";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Geocode an address to get lat/lng coordinates
 * Uses Google Maps Geocoding API via Manus proxy
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  try {
    const response = await makeRequest<{
      results: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
      }>;
      status: string;
    }>("/geocode/json", {
      address: address.trim(),
    });

    if (response.status !== "OK" || !response.results || response.results.length === 0) {
      console.warn(`[Geocoding] Failed to geocode address: ${address}`, response.status);
      return null;
    }

    const result = response.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error(`[Geocoding] Error geocoding address: ${address}`, error);
    return null;
  }
}

/**
 * Geocode multiple addresses in parallel
 */
export async function geocodeAddresses(addresses: string[]): Promise<Array<GeocodingResult | null>> {
  return Promise.all(addresses.map((addr) => geocodeAddress(addr)));
}
