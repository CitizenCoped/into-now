import type { Map as MapLibreMap } from "maplibre-gl";

export const BASE_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Pink-tinted darks over Carto dark-matter (The Best Drug basemap tint).
const PALETTE = {
  void: "#07060b",
  water: "#0a2a33",
  land: "#22121e",
  park: "#161018",
  road: "#3a1a30",
  roadMajor: "#4a2240",
  building: "#1a0f18",
  label: "#d8c8d2",
};

export function applyBrandMapStyle(map: MapLibreMap) {
  const set = (layer: string, prop: string, value: unknown) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };

  set("background", "background-color", PALETTE.void);

  for (const layer of ["water", "water_intermittent"]) {
    set(layer, "fill-color", PALETTE.water);
    set(layer, "fill-opacity", 0.85);
  }

  for (const layer of ["landuse", "landuse-residential", "landcover_grass", "landcover_wood", "landcover_sand"]) {
    const green = layer.includes("grass") || layer.includes("wood") || layer.includes("sand");
    set(layer, "fill-color", green ? PALETTE.park : PALETTE.land);
    set(layer, "fill-opacity", 0.6);
  }

  for (const layer of ["road_minor", "road_path", "road_secondary_tertiary", "road_trunk_primary", "road_major_motorway"]) {
    const major = layer.includes("trunk") || layer.includes("motorway") || layer.includes("secondary");
    set(layer, "line-color", major ? PALETTE.roadMajor : PALETTE.road);
    set(layer, "line-opacity", major ? 0.7 : 0.45);
  }

  set("building", "fill-color", PALETTE.building);
  set("building", "fill-opacity", 0.55);

  for (const layer of ["place_label_city", "place_label_other", "road_major_label"]) {
    set(layer, "text-color", PALETTE.label);
    set(layer, "text-halo-color", PALETTE.void);
    set(layer, "text-halo-width", 1.5);
  }
}
