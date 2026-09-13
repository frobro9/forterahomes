export interface GeocodeResult {
  lat: number;
  lng: number;
  score: number;
  matchedAddress: string;
}

const GEOCODE_URL =
  "https://maps.ottawa.ca/arcgis/rest/services/compositeLocator/GeocodeServer/findAddressCandidates";

/**
 * Free, City-of-Ottawa-operated single-line geocoder (Open Data Licence
 * 2.0 — same family of service as the zoning GIS layers already used
 * elsewhere in this app). Turns a plain address string (e.g. from a spec
 * sheet email) into lat/lng for the LiveGisMatcher.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    SingleLine: address,
    outSR: "4326",
    maxLocations: "1",
    f: "json",
  });

  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Geocode request failed (${response.status}) for "${address}"`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Geocode error for "${address}": ${JSON.stringify(data.error)}`);
  }

  const best = data.candidates?.[0];
  if (!best) return null;

  return {
    lat: best.location.y,
    lng: best.location.x,
    score: best.score,
    matchedAddress: best.address,
  };
}
