// EuroPoi — src/hooks/useGpx.js
// GPX laden en CSV import/export
import { useState, useCallback } from "react";
import {
  uid,
  isNum,
  encPlus,
  decPlus,
  normPlus,
  parseCoord,
  parseCSVLine,
  distToPolyline,
} from "../geoUtils";
import DB from "../db";

export function useGpx({ pois, setPois, addLog, setTriggered, track }) {
  const [route, setRoute] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeSessionId, setRouteSessionId] = useState(null);
  const [gpxWarn, setGpxWarn] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);

  // ── CSV export ──────────────────────────────────────────────────────────
  const exportCSV = useCallback(
    async (ppois) => {
      const src = ppois && ppois.length ? ppois : pois;
      // CSV-export: puntkomma als scheidingsteken, tekstvelden omsloten door dubbele
      // aanhalingstekens, interne aanhalingstekens verdubbeld (RFC 4180).
      const esc = (s) =>
        (s || "")
          .replace(/"/g, '""')
          .replace(/[\r\n\t]/g, " ")
          .trim();
      // Meerdere categorieën per POI: één rij per categorie (zoals het bronbestand)
      // Als een POI geen categorieën heeft valt deze terug op "Overig"
      const rows = [];
      for (const p of src) {
        const cats =
          p.categories && p.categories.length ? p.categories : ["Overig"];
        for (const cat of cats) {
          // lat/lng facultatief — pluscode is verplicht en leidend
          const lat = p.lat != null ? p.lat : "";
          const lng = p.lng != null ? p.lng : "";
          const q = (s) => `"${esc(s)}"`;
          rows.push(
            `${lat};${lng};${q(p.pluscode)};${q(p.name)};${q(p.desc)};${q(
              cat
            )};${p.radius || 0};${q(p.audioUrl || "")}`
          );
        }
      }
      const csv =
        "lat;lng;pluscode;name;desc;category;radius;mp3\r\n" +
        rows.join("\r\n");

      // Capacitor APK: gebruik Filesystem + Share
      const cap = window.Capacitor;
      const isNative =
        cap &&
        typeof cap.isNativePlatform === "function" &&
        cap.isNativePlatform();

      if (isNative && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
        try {
          const fileName = `EuroPoi_export_${Date.now()}.csv`;
          // Schrijf naar tijdelijke cache-map
          await cap.Plugins.Filesystem.writeFile({
            path: fileName,
            data: btoa(unescape(encodeURIComponent(csv))),
            directory: "CACHE",
            encoding: null, // binary (base64)
          });
          const { uri } = await cap.Plugins.Filesystem.getUri({
            path: fileName,
            directory: "CACHE",
          });
          await cap.Plugins.Share.share({
            title: "EuroPoi export",
            text: "EuroPoi POI-export",
            url: uri,
            dialogTitle: "Exporteer als…",
          });
          addLog(`Geëxporteerd: ${src.length} POIs`);
          return;
        } catch (err) {
          addLog(`Export fout (Capacitor): ${err.message} — probeer browser`);
        }
      }

      // Browser-fallback (Codesandbox / desktop)
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: "EuroPoi_export.csv",
        style: "display:none",
      });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);
      addLog(`Geëxporteerd: ${src.length} POIs`);
    },
    [pois, addLog]
  );

  // ── CSV import ──────────────────────────────────────────────────────────
  const importCSV = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = async (evt) => {
        const raw = evt.target.result
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");
        const lines = raw.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          addLog("CSV: te weinig regels");
          return;
        }
        const header = parseCSVLine(lines[0]).map((c) =>
          c.toLowerCase().replace(/"/g, "")
        );
        const ix = {
          lat: -1,
          lng: -1,
          plus: -1,
          name: -1,
          desc: -1,
          cat: -1,
          rad: -1,
          audio: -1,
        };
        header.forEach((x, i) => {
          if (x.includes("lat")) ix.lat = i;
          else if (x.includes("lng") || x.includes("lon")) ix.lng = i;
          else if (x.includes("plus")) ix.plus = i;
          else if (x.includes("name") || x.includes("naam")) ix.name = i;
          else if (x.includes("desc") || x.includes("besch")) ix.desc = i;
          else if (x.includes("cat")) ix.cat = i;
          else if (x.includes("rad")) ix.rad = i;
          else if (
            x.includes("mp3") ||
            x.includes("audio") ||
            x.includes("link")
          )
            ix.audio = i;
        });
        // Groepeer rijen op pluscode: één CSV-rij per categorie → één POI met array
        const byPlus = new Map();
        for (const row of lines.slice(1)) {
          if (!row.trim()) continue;
          const cols = parseCSVLine(row);
          const get = (i) =>
            i > -1 ? (cols[i] || "").replace(/^"+|"+$/g, "").trim() : "";
          let la = parseCoord(get(ix.lat)),
            lo = parseCoord(get(ix.lng));
          const plus = get(ix.plus);
          // Pluscode is verplicht en leidend: altijd coördinaten afleiden uit pluscode
          // lat/lng uit CSV zijn facultatief en worden alleen gebruikt als pluscode ontbreekt
          if (plus) {
            const d = decPlus(plus);
            if (d) {
              la = d.lat;
              lo = d.lng;
            }
          }
          if (!isNum(la) || !isNum(lo)) {
            // Geen pluscode én geen geldige lat/lng: rij overslaan
            continue;
          }
          if (!plus) continue; // pluscode verplicht
          const key = normPlus(plus) || `${la},${lo}`;
          const cat = get(ix.cat).trim();
          if (byPlus.has(key)) {
            if (cat && !byPlus.get(key).categories.includes(cat))
              byPlus.get(key).categories.push(cat);
          } else {
            byPlus.set(key, {
              id: uid(),
              lat: la,
              lng: lo,
              pluscode: plus || encPlus(la, lo),
              name: get(ix.name) || "POI",
              desc: get(ix.desc) || "",
              categories: cat ? [cat] : ["Overig"],
              radius: parseInt(get(ix.rad)) || 0,
              audioUrl: get(ix.audio) || "",
            });
          }
        }

        const imported = Array.from(byPlus.values());

        // Samenvoegen met bestaande POIs op pluscode — geen duplicaten
        setPois((prev) => {
          const existingByPlus = new Map(
            prev.map((p) => [normPlus(p.pluscode), p])
          );
          const merged = [...prev];
          for (const p of imported) {
            const key = normPlus(p.pluscode);
            if (existingByPlus.has(key)) {
              const existing = existingByPlus.get(key);
              const idx = merged.findIndex((x) => x.id === existing.id);
              const updated = {
                ...existing,
                name: p.name || existing.name,
                desc: p.desc || existing.desc,
                audioUrl: p.audioUrl || existing.audioUrl,
                radius: p.radius || existing.radius,
                categories: Array.from(
                  new Set([
                    ...(existing.categories || []),
                    ...(p.categories || []),
                  ])
                ),
              };
              merged[idx] = updated;
              DB.save(updated);
            } else {
              merged.unshift(p);
              DB.save(p);
            }
          }
          return merged;
        });
        addLog(
          `CSV: ${imported.length} POIs geladen (${lines.length - 1} rijen)`
        );
      };
      rd.readAsText(file, "utf-8");
      e.target.value = "";
    },
    [addLog, setPois]
  );

  // ── Bulk audio import ───────────────────────────────────────────────────
  const importBulk = useCallback(
    async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const linked = [],
        updatedPois = [...pois];
      for (const f of files) {
        const ext = f.name.split(".").pop().toLowerCase();
        if (!["mp3", "wav"].includes(ext)) continue;
        const fileCode = normPlus(f.name.replace(/\.[^.]+$/, ""));
        if (!fileCode) continue;
        const data = await new Promise((r) => {
          const rd = new FileReader();
          rd.onloadend = () => r(rd.result);
          rd.readAsDataURL(f);
        });
        let matched = false;
        updatedPois.forEach((p) => {
          if (normPlus(p.pluscode) === fileCode) {
            p.audioBulk = data;
            p.audioBulkName = f.name;
            DB.save(p);
            matched = true;
          }
        });
        if (matched) linked.push(f.name);
      }
      setPois([...updatedPois]);
      setBulkStatus({ count: linked.length, names: linked });
      addLog(`Bulk: ${linked.length} bestand(en) gekoppeld`);
      e.target.value = "";
    },
    [pois, setPois, addLog]
  );

  // ── GPX laden ───────────────────────────────────────────────────────────
  const loadGpx = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = (evt) => {
        const xml = new DOMParser().parseFromString(
          evt.target.result,
          "text/xml"
        );
        const gpxName = file.name.replace(/\.gpx$/i, "");
        const hasRoute = xml.getElementsByTagName("rtept").length > 0;
        const hasTrack = xml.getElementsByTagName("trkpt").length > 0;

        if (hasTrack && !hasRoute) {
          setGpxWarn({ xml, fileName: file.name, gpxName });
        } else if (hasRoute) {
          const pts = Array.from(xml.getElementsByTagName("rtept")).map((p) => [
            parseFloat(p.getAttribute("lat")),
            parseFloat(p.getAttribute("lon")),
          ]);
          if (pts.length) {
            // Wis triggered entries voor route-POIs
            setTriggered((prev) => {
              const next = { ...prev };
              pois.forEach((p) => {
                if (
                  (p.categories || [])
                    .map((c) => c.toLowerCase())
                    .includes(gpxName.toLowerCase())
                )
                  delete next[p.id];
              });
              return next;
            });
            setRoute(pts);
            setRouteName(gpxName);
            setRouteSessionId(uid());
            addLog(`Route GPX: ${pts.length} punten — "${gpxName}"`);
          }
        } else {
          addLog(`GPX: geen route- of track-punten in ${file.name}`);
        }
      };
      rd.readAsText(file);
      e.target.value = "";
    },
    [pois, addLog, setTriggered]
  );

  // ── Track accepteren (gpxWarn) ──────────────────────────────────────────
  const acceptGpxTrack = useCallback(() => {
    if (!gpxWarn) return;
    const pts = Array.from(gpxWarn.xml.getElementsByTagName("trkpt")).map(
      (p) => [
        parseFloat(p.getAttribute("lat")),
        parseFloat(p.getAttribute("lon")),
      ]
    );
    if (pts.length) {
      const rn = gpxWarn.gpxName || gpxWarn.fileName.replace(/\.gpx$/i, "");
      setTriggered((prev) => {
        const next = { ...prev };
        pois.forEach((p) => {
          if (
            (p.categories || [])
              .map((c) => c.toLowerCase())
              .includes(rn.toLowerCase())
          )
            delete next[p.id];
        });
        return next;
      });
      setRoute(pts);
      setRouteName(rn);
      setRouteSessionId(uid());
      addLog(`Track GPX geaccepteerd: ${pts.length} punten — "${rn}"`);
    }
    setGpxWarn(null);
  }, [gpxWarn, pois, addLog, setTriggered]);

  // ── Track opslaan als GPX ───────────────────────────────────────────────
  const saveTrack = useCallback(async () => {
    if (!track.length) {
      addLog("Geen track");
      return;
    }
    const pts = track
      .map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}"></trkpt>`)
      .join("");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="EuroPoi"><trk><n>Track ${new Date().toLocaleString()}</n><trkseg>${pts}</trkseg></trk></gpx>`;
    const fileName = `track_${Date.now()}.gpx`;

    // Capacitor APK: gebruik Filesystem + Share
    const cap = window.Capacitor;
    const isNative = cap?.isNativePlatform?.();
    if (isNative && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
      try {
        await cap.Plugins.Filesystem.writeFile({
          path: fileName,
          data: btoa(unescape(encodeURIComponent(gpx))),
          directory: "CACHE",
          encoding: null,
        });
        const { uri } = await cap.Plugins.Filesystem.getUri({
          path: fileName,
          directory: "CACHE",
        });
        await cap.Plugins.Share.share({
          title: "EuroPoi track",
          text: "GPS track opgeslagen",
          url: uri,
          dialogTitle: "Sla track op als…",
        });
        addLog(`Track opgeslagen: ${track.length} punten`);
        return;
      } catch (err) {
        addLog(`Track opslaan fout: ${err.message}`);
      }
    }

    // Browser fallback
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(
        new Blob([gpx], { type: "application/gpx+xml" })
      ),
      download: fileName,
      style: "display:none",
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
    addLog(`Track opgeslagen: ${track.length} punten`);
  }, [track, addLog]);

  return {
    route,
    setRoute,
    routeName,
    setRouteName,
    routeSessionId,
    setRouteSessionId,
    gpxWarn,
    setGpxWarn,
    bulkStatus,
    setBulkStatus,
    exportCSV,
    importCSV,
    importBulk,
    loadGpx,
    acceptGpxTrack,
    saveTrack,
  };
}
