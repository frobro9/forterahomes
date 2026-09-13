/**
 * Official Ottawa Neighbourhood Study boundary names, extracted from the
 * City of Ottawa's live GIS layer (same source lib/geocode/neighbourhoodMatch.ts
 * queries at ingest time to resolve each listing's neighbourhood via
 * point-in-polygon lookup). Baked in as a static list rather than fetched
 * on every settings page render: boundaries are revised on the order of
 * once a year, not per-request, and a static list keeps the settings page
 * from taking on a live external dependency just to draw checkboxes.
 *
 * Regenerate by querying:
 * https://maps.ottawa.ca/arcgis/rest/services/Neighbourhoods/MapServer/2/query?where=1=1&outFields=NAME&returnGeometry=false&returnDistinctValues=true&orderByFields=NAME&f=json
 *
 * Note: small, colloquially-named enclaves (e.g. Lindenlea, Beechwood
 * Village) don't have their own polygon in this dataset — they fall
 * within a larger official boundary (Lindenlea and Beechwood Village are
 * both within "New Edinburgh"), so matchNeighbourhood() will resolve
 * listings there to the containing official name, not the colloquial one.
 */
export const OTTAWA_NEIGHBOURHOODS: string[] = [
  "Airport",
  "Alta Vista",
  "Bayshore",
  "Beacon Hill South - Cardinal Heights",
  "Beaverbrook",
  "Beechwood Cemetery",
  "Bells Corners East",
  "Bells Corners West",
  "Billings Bridge - Huron Park",
  "Blackburn Hamlet",
  "Blossom Park - Timbermill",
  "Borden Farm - Fisher Glen",
  "Braemar Park - Bel Air Heights - Copeland Park",
  "Bridlewood - Emerald Meadows",
  "Britannia",
  "Brookside - Briarbrook - Morgan's Grant",
  "Cardinal Creek",
  "Carleton Heights - Courtland Park",
  "Carleton University",
  "Carlington",
  "Carp",
  "Carson Grove - Carson Meadows",
  "Centrepointe",
  "Centretown",
  "Chapel Hill North",
  "Chapel Hill South",
  "Chapman Mills",
  "City view",
  "Civic Hospital",
  "Colonnade Business Park",
  "Constance Bay",
  "Convent Glen - Orléans Woods",
  "Corkery",
  "Craig Henry - Manordale",
  "Crestview - Tanglewood",
  "Crystal Bay - Lakeview Park",
  "Cumberland",
  "Dunrobin",
  "Edwards - Carlsbad Springs",
  "Elmvale - Canterbury",
  "Emerald Woods - Sawmill Creek",
  "Experimental Farm",
  "Fallingbrook",
  "Findlay Creek",
  "Fisher Heights",
  "Fitzroy",
  "Glebe - Dows Lake",
  "Glen Cairn",
  "Greely",
  "Greenbelt East",
  "Greenbelt West",
  "Greenboro East",
  "Greenboro West",
  "Hawthorne Meadows - Sheffield Glen",
  "Hintonburg - Mechanicsville",
  "Hunt Club Park",
  "Industrial East",
  "Iris",
  "Island Park - Wellington Village",
  "Kanata Lakes",
  "Katimavik - Hazeldean",
  "Kinburn",
  "Laurentian",
  "Lebreton Development",
  "Ledbury - Heron Gate - Ridgemont",
  "Leslie Park - Bruce Farm",
  "Lowertown East",
  "Lowertown West",
  "Manor Park",
  "Manotick",
  "Marlborough",
  "Merivale Gardens - Grenfell Glen - Pineglen - Country Place",
  "Metcalfe",
  "Munster - Ashton",
  "Navan - Sarsfield",
  "New Edinburgh",
  "North Gower - Kars",
  "Old Barrhaven East",
  "Old Barrhaven West",
  "Old Hunt Club",
  "Old Ottawa East",
  "Old Ottawa South",
  "Orléans Industrial",
  "Orléans Village - Chateauneuf",
  "Osgoode - Vernon",
  "Overbrook",
  "Parkwood Hills",
  "Pineview",
  "Playfair Park - Guildwood Estates",
  "Portobello South",
  "Qualicum - Redwood",
  "Queensway Terrace North",
  "Queenswood - Chatelaine",
  "Queenswood Heights",
  "Richmond",
  "Rideau Crest - Davidson Heights",
  "Riverside Park - Mooney's Bay",
  "Riverside Park South - Revelstoke",
  "Riverside South - Leitrim",
  "Riverview",
  "Rockcliffe Park",
  "Rothwell Heights - Beacon Hill North",
  "Sandy Hill",
  "South Keys",
  "Stittsville",
  "Stittsville East",
  "Stittsville North",
  "Stonebridge - Half Moon Bay",
  "Trend-Arlington",
  "Vanier North",
  "Vanier South",
  "Vars",
  "Wateridge Village",
  "West Centretown",
  "Westboro",
  "Whitehaven - Woodpark - Glabar Park"
];

/**
 * The subset of OTTAWA_NEIGHBOURHOODS that actually falls within the area
 * the OneHome spec-sheet emails cover — roughly Woodroffe Ave (west) to
 * St Laurent Blvd (east), and Meadowlands Dr (south) to the Ottawa River
 * (north). The settings page's target-area filter uses this instead of
 * the full 116-neighbourhood list so it isn't cluttered with suburbs no
 * listing will ever actually be in.
 *
 * Derived, not hand-picked: geocoded a few points along each boundary
 * street (via lib/geocode/ottawaGeocoder.ts against the City's own
 * locator) to get a bounding box —
 *   Woodroffe Ave @ Baseline/Carling/Richmond -> lng ~-75.76 to -75.775 (west edge, use -75.78)
 *   St Laurent Blvd @ Smyth/Ogilvie/Montreal -> lng ~-75.62 to -75.65 (east edge, use -75.62)
 *   Meadowlands Dr @ Merivale/Prince of Wales -> lat ~45.35 to 45.37 (south edge, use 45.35)
 *   Ottawa River -> no neighbourhood polygon extends past it anyway, so
 *     the north edge just needs to be generous (45.46) rather than exact.
 * — then queried the Neighbourhoods/MapServer/2 layer for every polygon
 * in a wide envelope, computed each polygon's area-weighted centroid
 * (shoelace formula) from its returned ring geometry, and kept the names
 * whose centroid falls inside that box. Centroid-based rather than
 * "any intersection" on purpose: an intersects test also pulls in
 * neighbourhoods that just clip a corner of the box (e.g. Airport, Hunt
 * Club Park), which isn't what "roughly bounded by these streets" means.
 *
 * A few results sit close to the southern edge (Blossom Park - Timbermill,
 * South Keys, Greenboro East/West) — legitimately inside this exact box,
 * but worth a second look if the real spec-sheet coverage turns out to
 * run tighter than Meadowlands Dr in practice.
 */
export const SPEC_SHEET_NEIGHBOURHOODS: string[] = [
  "Alta Vista",
  "Beechwood Cemetery",
  "Billings Bridge - Huron Park",
  "Blossom Park - Timbermill",
  "Borden Farm - Fisher Glen",
  "Braemar Park - Bel Air Heights - Copeland Park",
  "Carleton Heights - Courtland Park",
  "Carleton University",
  "Carlington",
  "Carson Grove - Carson Meadows",
  "Centretown",
  "City view",
  "Civic Hospital",
  "Elmvale - Canterbury",
  "Experimental Farm",
  "Fisher Heights",
  "Glebe - Dows Lake",
  "Greenboro East",
  "Greenboro West",
  "Hintonburg - Mechanicsville",
  "Iris",
  "Island Park - Wellington Village",
  "Laurentian",
  "Lebreton Development",
  "Ledbury - Heron Gate - Ridgemont",
  "Lowertown East",
  "Lowertown West",
  "Manor Park",
  "New Edinburgh",
  "Old Ottawa East",
  "Old Ottawa South",
  "Overbrook",
  "Parkwood Hills",
  "Playfair Park - Guildwood Estates",
  "Riverside Park - Mooney's Bay",
  "Riverside Park South - Revelstoke",
  "Riverview",
  "Rockcliffe Park",
  "Sandy Hill",
  "South Keys",
  "Vanier North",
  "Vanier South",
  "Wateridge Village",
  "West Centretown",
  "Westboro",
  "Whitehaven - Woodpark - Glabar Park"
];
