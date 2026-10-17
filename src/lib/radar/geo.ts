import "server-only";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-50m.json";

export const MAP_W = 1000;
export const MAP_H = 820;

const projection = geoMercator();
// Fit to the corners of the JAPAC frame (a MultiPoint avoids spherical winding issues with polygons).
const bbox: Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiPoint",
    coordinates: [
      [64.5, 46.5],
      [156, -44.5],
    ],
  },
};
projection.fitExtent(
  [
    [0, 0],
    [MAP_W, MAP_H],
  ],
  bbox,
);
projection.clipExtent([
  [-500, -500],
  [MAP_W + 500, MAP_H + 500],
]);

const path = geoPath(projection);

let landCache: string[] | null = null;

/** Country outlines inside the JAPAC frame, as SVG path strings. */
export function landPaths(): string[] {
  if (landCache) return landCache;
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>;
  landCache = fc.features.map((f) => path(f) ?? "").filter((d) => d.length > 0);
  return landCache;
}

export function project(at: [number, number]): [number, number] {
  const p = projection(at) ?? [0, 0];
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}
