const NEIGHBOURHOOD_LAYER =
  "https://maps.ottawa.ca/arcgis/rest/services/Neighbourhoods/MapServer/2/query";

/**
 * Free, City-of-Ottawa-operated neighbourhood boundary layer (same Open
 * Data Licence family as the zoning GIS layers and geocoder already used
 * elsewhere in this app) — "Ottawa Neighbourhood Study Boundaries Gen 3
 * (2024)". Point-in-polygon lookup by lat/lng, same pattern as
 * lib/zoning/gisMatch.ts's LiveGisMatcher.
 */
export async function matchNeighbourhood(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME",
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(`${NEIGHBOURHOOD_LAYER}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Neighbourhood query failed (${response.status})`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Neighbourhood query error: ${JSON.stringify(data.error)}`);
  }

  const name = data.features?.[0]?.attributes?.NAME;
  return typeof name === "string" ? name : null;
}
