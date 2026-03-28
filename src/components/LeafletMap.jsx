import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import { MAP_TILES, Z } from "../config";
import { isNum } from "../geoUtils";

const LeafletMap = ({
  loc,
  follow,
  setCenter,
  tileKey,
  setTileKey,
  pois,
  route,
  track,
  ready,
  onPoiClick,
  highlightId,
  crosshairActive,
  t,
}) => {
  const containerRef = useRef(null),
    mapRef = useRef(null),
    umarkRef = useRef(null);
  const marksRef = useRef({}),
    circsRef = useRef({}),
    routeRef = useRef(null),
    trackRef = useRef(null);
  const initDone = useRef(false);

  // Initialiseer kaart
  useEffect(() => {
    if (!ready || !containerRef.current || !window.L || initDone.current)
      return;
    initDone.current = true;
    const map = window.L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView([loc.lat, loc.lng], 16);
    window.L.tileLayer(MAP_TILES[tileKey], { maxZoom: 19 }).addTo(map);
    const ico = window.L.divIcon({
      className: "",
      html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,.8);position:relative">
               <div style="position:absolute;inset:-7px;background:rgba(59,130,246,.2);border-radius:50%;animation:ping 2s infinite"></div>
             </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    umarkRef.current = window.L.marker([loc.lat, loc.lng], {
      icon: ico,
      zIndexOffset: 1000,
    }).addTo(map);
    map.on("move", () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    });
    mapRef.current = map;
    [50, 300, 800].forEach((d) => setTimeout(() => map.invalidateSize(), d));
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // Wissel tile layer
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    mapRef.current.eachLayer((l) => {
      if (l instanceof window.L.TileLayer) mapRef.current.removeLayer(l);
    });
    window.L.tileLayer(MAP_TILES[tileKey], { maxZoom: 19 }).addTo(
      mapRef.current
    );
  }, [tileKey]);

  // Volg gebruikerlocatie
  useEffect(() => {
    if (!umarkRef.current || !isNum(loc.lat)) return;
    umarkRef.current.setLatLng([loc.lat, loc.lng]);
    if (follow && mapRef.current) mapRef.current.panTo([loc.lat, loc.lng]);
  }, [loc, follow]);

  // POI markers & cirkels
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    Object.values(marksRef.current).forEach((m) =>
      mapRef.current.removeLayer(m)
    );
    Object.values(circsRef.current).forEach((c) =>
      mapRef.current.removeLayer(c)
    );
    marksRef.current = {};
    circsRef.current = {};
    pois.forEach((p) => {
      if (!isNum(p.lat)) return;
      const isHL = p.id === highlightId;
      const isRoute = p.useRouteTrigger;
      const inRange = p.dist <= (p.effR || 100);
      // Kleur: geel=highlight, groen=in bereik, blauw=route-gekoppeld, rood=normaal
      const col = isHL
        ? "#facc15"
        : inRange
        ? "#22c55e"
        : isRoute
        ? "#3b82f6"
        : "#ef4444";
      const stroke = isHL ? "#92400e" : isRoute ? "#1e3a8a" : "rgba(0,0,0,.3)";
      const sz = isHL ? 34 : 26;
      // Route-vlaggetje krijgt een ster/ruit overlay
      const badge =
        isRoute && !isHL
          ? `<circle cx="18" cy="6" r="5" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
           <text x="18" y="10" text-anchor="middle" font-size="7" font-weight="900" fill="white">R</text>`
          : "";
      const svg = `<svg width="${
        sz + (isRoute && !isHL ? 8 : 0)
      }" height="${sz}" viewBox="0 0 ${
        24 + (isRoute && !isHL ? 8 : 0)
      } 24" fill="${col}"
                    stroke="${stroke}" stroke-width="${isHL ? 2 : 1.5}">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z"/>
                    <line x1="4" y1="22" x2="4" y2="15"/>
                    ${badge}
                  </svg>`;
      const m = window.L.marker([p.lat, p.lng], {
        icon: window.L.divIcon({
          className: "",
          html: svg,
          iconSize: [sz, sz],
          iconAnchor: [4, sz],
          zIndexOffset: isHL ? 500 : isRoute ? 100 : 0,
        }),
      }).addTo(mapRef.current);
      m.on("click", (e) => {
        window.L.DomEvent.stopPropagation(e);
        onPoiClick(p);
      });
      marksRef.current[p.id] = m;
      const ci = window.L.circle([p.lat, p.lng], {
        radius: Math.min(p.effR || 100, 50000),
        stroke: isHL || isRoute,
        color: isHL ? "#facc15" : isRoute ? "#3b82f6" : "transparent",
        weight: isRoute ? 1.5 : 2,
        fillColor: col,
        fillOpacity: isHL ? 0.3 : isRoute ? 0.12 : 0.15,
        dashArray: isRoute && !isHL ? "6 4" : null,
      }).addTo(mapRef.current);
      ci.on("click", (e) => {
        window.L.DomEvent.stopPropagation(e);
        onPoiClick(p);
      });
      circsRef.current[p.id] = ci;
    });
  }, [pois, onPoiClick, highlightId]);

  // Extern pannen — via ref aanroepbaar vanuit parent
  useEffect(() => {
    if (!mapRef.current || !highlightId) return;
    const poi = pois.find((p) => p.id === highlightId);
    if (poi && isNum(poi.lat)) {
      mapRef.current.panTo([poi.lat, poi.lng], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [highlightId, pois]);
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (routeRef.current) mapRef.current.removeLayer(routeRef.current);
    if (trackRef.current) mapRef.current.removeLayer(trackRef.current);
    if (route.length > 0)
      routeRef.current = window.L.polyline(route, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.7,
      }).addTo(mapRef.current);
    if (track.length > 0)
      trackRef.current = window.L.polyline(track, {
        color: "#f87171",
        weight: 3,
        dashArray: "6 10",
      }).addTo(mapRef.current);
  }, [route, track]);

  return (
    <div className="relative w-full h-full" style={{ zIndex: Z.map }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* OSM + Leaflet disclaimer — rechtsonder */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            padding: "2px 8px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <span style={{ fontSize: "6.5px", color: "rgba(255,255,255,0.6)" }}>
            &copy; OpenStreetMap · Leaflet
          </span>
        </div>
      </div>

      {/* OSM/SAT wissel — z-index 1000 zodat hij altijd klikbaar is */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
          display: "flex",
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          padding: "4px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {Object.keys(MAP_TILES).map((k) => (
          <button
            key={k}
            onClick={() => setTileKey(k)}
            style={{
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "9px",
              fontWeight: "900",
              textTransform: "uppercase",
              transition: "all 0.15s",
              background: tileKey === k ? "#2563eb" : "transparent",
              color: tileKey === k ? "white" : "rgba(30,30,30,0.7)",
            }}
          >
            {k === "osm" ? t.osm : t.sat}
          </button>
        ))}
      </div>

      {/* Crosshair prikpunt — alleen zichtbaar als expliciet ingeschakeld via knop */}
      {crosshairActive && !highlightId && (
        <div
          style={{
            zIndex: 1000,
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {/* Horizontale lijn */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: "1px",
              background: "rgba(96,165,250,0.8)",
              transform: "translateY(-0.5px)",
            }}
          />
          {/* Verticale lijn */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: "1px",
              background: "rgba(96,165,250,0.8)",
              transform: "translateX(-0.5px)",
            }}
          />
          {/* Cirkel + rood punt */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "32px",
              height: "32px",
              border: "2px solid rgba(96,165,250,0.9)",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "8px",
              height: "8px",
              background: "#ef4444",
              borderRadius: "50%",
              border: "2px solid white",
              boxShadow: "0 0 6px rgba(239,68,68,0.9)",
            }}
          />
          {/* Label */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(29,78,216,0.9)",
              color: "white",
              fontSize: "9px",
              fontWeight: "900",
              padding: "4px 12px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.3)",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
            }}
          >
            ✛ SLEEP KAART · DRUK + POI
          </div>
        </div>
      )}
    </div>
  );
};

export default LeafletMap;
