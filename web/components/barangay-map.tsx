"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"
import L, { type LatLngBoundsExpression, type Layer, type PathOptions } from "leaflet"
import type { Feature, Polygon } from "geojson"

import { MAP_STEPS, MAP_SUPPRESSED, stepFor } from "@/lib/labels"
import { barangayGeo, type Cell } from "@/lib/mock-data"

export type BarangayValue = { cell: Cell; detail?: string }

type Props = { name: string; psgc_code: string }

const bounds: LatLngBoundsExpression = (() => {
  let [minLat, minLng, maxLat, maxLng] = [90, 180, -90, -180]
  for (const f of barangayGeo.features)
    for (const ring of f.geometry.coordinates)
      for (const [lng, lat] of ring) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
})()

const idOf = (f: Feature<Polygon, Props>) => +f.properties.psgc_code.slice(-3)
const escape = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * Choropleth of an aggregate per barangay, drawn on official barangay boundaries.
 * Suppressed barangays (<5 people) are plain grey so their shade reveals nothing.
 * Loaded with next/dynamic (ssr: false) because Leaflet needs `window`.
 *
 * Leaflet is driven directly from effects rather than through react-leaflet: Next keeps visited
 * routes in a hidden <Activity>, which tears effects down and re-runs them, and react-leaflet's
 * MapContainer can't recreate its map after that ("Map container is being reused").
 */
export default function BarangayMap({
  values,
  metricLabel,
  selectedId,
  onSelect,
}: {
  values: Record<number, BarangayValue>
  metricLabel: string
  selectedId?: number
  onSelect?: (id: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const map = L.map(containerRef.current!, { scrollWheelZoom: false }).fitBounds(bounds)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Boundaries: PSA via faeldon/philippines-json-maps',
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const max = Math.max(1, ...Object.values(values).map((v) => v.cell.count ?? 0))

    function style(feature?: Feature): PathOptions {
      const id = idOf(feature as Feature<Polygon, Props>)
      const cell = values[id]?.cell
      const selected = id === selectedId
      const base: PathOptions = { weight: selected ? 3 : 1, color: selected ? "#1f1640" : "#ffffff", opacity: 1 }
      if (!cell || cell.suppressed || cell.count == null) return { ...base, fillColor: MAP_SUPPRESSED, fillOpacity: 0.55, dashArray: selected ? undefined : "2 3", color: selected ? "#1f1640" : "#6b7280" }
      return { ...base, fillColor: MAP_STEPS[stepFor(cell.count, max)], fillOpacity: 0.8 }
    }

    function onEachFeature(feature: Feature, layer: Layer) {
      const f = feature as Feature<Polygon, Props>
      const v = values[idOf(f)]
      const count = !v || v.cell.suppressed ? "&lt;5 (hidden)" : v.cell.count?.toLocaleString()
      layer.bindTooltip(
        `<strong>${escape(f.properties.name)}</strong><br/>${escape(metricLabel)}: ${count}${v?.detail ? `<br/><span style="color:#6b7280">${escape(v.detail)}</span>` : ""}`,
        { sticky: true },
      )
      layer.on({
        click: () => onSelectRef.current?.(idOf(f)),
        mouseover: (e) => e.target.setStyle({ weight: 3, color: "#1f1640" }),
        mouseout: (e) => e.target.setStyle(style(feature)),
      })
    }

    const layer = L.geoJSON(barangayGeo, { style, onEachFeature }).addTo(map)
    return () => {
      layer.remove()
    }
  }, [values, metricLabel, selectedId])

  return <div ref={containerRef} className="z-0 h-full w-full rounded-lg" />
}
