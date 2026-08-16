const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OTTAWA_ZONING_QUERY_URL = 'https://maps.ottawa.ca/ArcGIS/rest/services/Zoning/MapServer/3/query';
// west,north,east,south — soft bias toward Ottawa so unqualified addresses resolve locally.
const OTTAWA_VIEWBOX = '-76.35,45.65,-75.20,44.95';

export async function geocodeAddress(address) {
  const query = /ottawa/i.test(address) ? address : `${address}, Ottawa, ON, Canada`;
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ca&viewbox=${OTTAWA_VIEWBOX}&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ForteraHomes-PropertyFinder/1.0 (+https://forterahomes.ca)' },
  });
  if (!res.ok) throw new Error('Geocoding service unavailable.');

  const results = await res.json();
  if (!results.length) return null;

  return { lat: Number(results[0].lat), lon: Number(results[0].lon), displayName: results[0].display_name };
}

// City of Ottawa Zoning By-law 2008-250 Consolidation (layer 3 of the public Zoning MapServer).
export async function lookupZoning(lat, lon) {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'ZONE_CODE,ZONE_MAIN,ZNAME_EN,HEIGHT',
    returnGeometry: 'false',
    f: 'json',
  });

  const res = await fetch(`${OTTAWA_ZONING_QUERY_URL}?${params}`);
  if (!res.ok) throw new Error('Zoning lookup unavailable.');

  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) return null;

  return {
    zoneCode: feature.attributes.ZONE_CODE || null,
    zoneMain: feature.attributes.ZONE_MAIN || null,
    zoneName: feature.attributes.ZNAME_EN || null,
    height: feature.attributes.HEIGHT ?? null,
  };
}
