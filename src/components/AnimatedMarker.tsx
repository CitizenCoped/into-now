"use client";

import { distanceKm } from "@/lib/geo";
import { Marker } from "react-map-gl/maplibre";
import { useEffect, useRef, useState, type ComponentProps } from "react";

const ANIMATE_MS = 1500;
// Beyond this, glide would look like flying — snap instead.
const SNAP_DISTANCE_KM = 2;

type MarkerProps = ComponentProps<typeof Marker>;

type Props = Pick<MarkerProps, "anchor" | "onClick" | "children"> & {
  latitude: number;
  longitude: number;
};

export default function AnimatedMarker({
  latitude,
  longitude,
  anchor = "center",
  onClick,
  children,
}: Props) {
  const [pos, setPos] = useState({ lat: latitude, lng: longitude });
  const posRef = useRef(pos);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = posRef.current;
    const to = { lat: latitude, lng: longitude };
    if (from.lat === to.lat && from.lng === to.lng) return;

    if (frame.current !== null) cancelAnimationFrame(frame.current);

    if (distanceKm(from.lat, from.lng, to.lat, to.lng) > SNAP_DISTANCE_KM) {
      posRef.current = to;
      setPos(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / ANIMATE_MS, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const next = {
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      };
      posRef.current = next;
      setPos(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [latitude, longitude]);

  return (
    <Marker latitude={pos.lat} longitude={pos.lng} anchor={anchor} onClick={onClick}>
      {children}
    </Marker>
  );
}
