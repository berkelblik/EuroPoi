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
  hav,
} from "../geoUtils";
import DB from "../db";

// ── GPX 1.1 namespace header (gedeeld door track én route export) ──────────
const GPX_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EuroPoi"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`;

// ── Deel-hulpfunctie (Capacitor Share + browser fallback) ─────────────────
async function deelBestand({ inhoud, bestandsNaam, mimeType, titel, tekst, addLog }) {
  const cap = window.Capacitor;
  const isNative = cap?.isNativePlatform?.();

  if (isNative && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
    try {
      await cap.Plugins.Filesystem.writeFile({
        path: bestandsNaam,
        data: btoa(unescape(encodeURIComponent(inhoud))),
        directory: "CACHE",
        encoding: null,
      });
      const { uri } = await cap.Plugins.Filesystem.getUri({
        path: bestandsNaam,
        directory: "CACHE",
      });
      await cap.Plugins.Share.share({
        title: titel,
        text: tekst,
        url: uri,
        dialogTitle: "Delen via…",
      });
      return true;
    } catch (err) {
      addLog(`Delen fout (Capacitor): ${err.message} — probeer browser`);
    }
  }

  // Browser fallback
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([inhoud], { type: mimeType })),
    download: bestandsNaam,
    style: "display:none",
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
  return true;
}

// ── Dichtstbijzijnde-buur sortering ──────────────────────────────────────
// Sorteert een array van POIs zodanig dat je startend vanuit startLat/startLng
// steeds naar de dichtstbijzijnde nog-niet-bezochte POI gaat.
function sorteerDichtstbijzijndeBuur(poisLijst, startLat, startLng) {
  if (!poisLijst.length) return [];
  const resterend = [...poisLijst];
  const gesorteerd = [];
  let huidigeL = startLat;
  let huidigeN = startLng;

  while (resterend.length) {
    let dichtstbij = 0;
    let minDist = Infinity;
    resterend.forEach((p, i) => {
      const d = hav(huidigeL, huidigeN, p.lat, p.lng);
      if (d < minDist) { minDist = d; dichtstbij = i; }
    });
    const gekozen = resterend.splice(dichtstbij, 1)[0];
    gesorteerd.push(gekozen);
    huidigeL = gekozen.lat;
    huidigeN = gekozen.lng;
  }
  return gesorteerd;
}

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

      await deelBestand({
        inhoud: "\uFEFF" + csv,
        bestandsNaam: `EuroPoi_export_${Date.now()}.csv`,
        mimeType: "text/csv;charset=utf-8",
        titel: "EuroPoi export",
        tekst: "EuroPoi POI-export",
        addLog,
      });
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
          lat: -1, lng: -1, plus: -1, name: -1,
          desc: -1, cat: -1, rad: -1, audio: -1,
        };
        header.forEach((x, i) => {
          if (x.includes("lat")) ix.lat = i;
          else if (x.includes("lng") || x.includes("lon")) ix.lng = i;
          else if (x.includes("plus")) ix.plus = i;
          else if (x.includes("name") || x.includes("naam")) ix.name = i;
          else if (x.includes("desc") || x.includes("besch")) ix.desc = i;
          else if (x.includes("cat")) ix.cat = i;
          else if (x.includes("rad")) ix.rad = i;
          else if (x.includes("mp3") || x.includes("audio") || x.includes("link"))
            ix.audio = i;
        });
        const byPlus = new Map();
        for (const row of lines.slice(1)) {
          if (!row.trim()) continue;
          const cols = parseCSVLine(row);
          const get = (i) =>
            i > -1 ? (cols[i] || "").replace(/^"+|"+$/g, "").trim() : "";
          let la = parseCoord(get(ix.lat)),
            lo = parseCoord(get(ix.lng));
          const plus = get(ix.plus);
          if (plus) {
            const d = decPlus(plus);
            if (d) { la = d.lat; lo = d.lng; }
          }
          if (!isNum(la) || !isNum(lo)) continue;
          if (!plus) continue;
          const key = normPlus(plus) || `${la},${lo}`;
          const cat = get(ix.cat).trim();
          if (byPlus.has(key)) {
            if (cat && !byPlus.get(key).categories.includes(cat))
              byPlus.get(key).categories.push(cat);
          } else {
            byPlus.set(key, {
              id: uid(),
              lat: la, lng: lo,
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
        setPois((prev) => {
          const existingByPlus = new Map(prev.map((p) => [normPlus(p.pluscode), p]));
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
                  new Set([...(existing.categories || []), ...(p.categories || [])])
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
        addLog(`CSV: ${imported.length} POIs geladen (${lines.length - 1} rijen)`);
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
      const linked = [], updatedPois = [...pois];
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
        const xml = new DOMParser().parseFromString(evt.target.result, "text/xml");
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
            setTriggered((prev) => {
              const next = { ...prev };
              pois.forEach((p) => {
                if ((p.categories || []).map((c) => c.toLowerCase())
                  .includes(gpxName.toLowerCase()))
                  delete next[p.id];
              });
              return next;
            });
            setRoute(pts);
            setRouteName(gpxName);
            setRouteSessionId(uid());
            addLog(`Route GPX (<rtept>): ${pts.length} waypoints — "${gpxName}"`);
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
    const pts = Array.from(gpxWarn.xml.getElementsByTagName("trkpt")).map((p) => [
      parseFloat(p.getAttribute("lat")),
      parseFloat(p.getAttribute("lon")),
    ]);
    if (pts.length) {
      const rn = gpxWarn.gpxName || gpxWarn.fileName.replace(/\.gpx$/i, "");
      setTriggered((prev) => {
        const next = { ...prev };
        pois.forEach((p) => {
          if ((p.categories || []).map((c) => c.toLowerCase()).includes(rn.toLowerCase()))
            delete next[p.id];
        });
        return next;
      });
      setRoute(pts);
      setRouteName(rn);
      setRouteSessionId(uid());
      addLog(`Track GPX geaccepteerd (<trkpt>): ${pts.length} punten — "${rn}"`);
    }
    setGpxWarn(null);
  }, [gpxWarn, pois, addLog, setTriggered]);

  // ── Track opslaan als GPX 1.1 ───────────────────────────────────────────
  // Correct formaat: <trk> met <trkseg> en <trkpt> elementen
  // Tijdstempel per punt indien beschikbaar, anders huidige tijd als basis
  const saveTrack = useCallback(async () => {
    if (!track.length) { addLog("Geen track om op te slaan"); return; }

    const nu = new Date();
    const trkPunten = track
      .map((p, i) => {
        // Schat tijdstempel: elk punt ~1 seconde na het vorige
        const ts = new Date(nu.getTime() - (track.length - 1 - i) * 1000);
        return `    <trkpt lat="${p[0].toFixed(7)}" lon="${p[1].toFixed(7)}">
      <time>${ts.toISOString()}</time>
    </trkpt>`;
      })
      .join("\n");

    const trackNaam = `EuroPoi Track ${nu.toLocaleDateString("nl-NL")} ${nu.toLocaleTimeString("nl-NL")}`;
    const gpx = `${GPX_HEADER}
  <trk>
    <name>${trackNaam}</name>
    <trkseg>
${trkPunten}
    </trkseg>
  </trk>
</gpx>`;

    const bestandsNaam = `EuroPoi_track_${Date.now()}.gpx`;
    await deelBestand({
      inhoud: gpx,
      bestandsNaam,
      mimeType: "application/gpx+xml",
      titel: "EuroPoi track",
      tekst: `GPS track — ${track.length} punten`,
      addLog,
    });
    addLog(`Track opgeslagen: ${track.length} punten (GPX 1.1 <trkpt>)`);
  }, [track, addLog]);

  // ── GPX route exporteren (rte) ──────────────────────────────────────────
  // Exporteert alle POIs van de actieve categorie (eerste categorie per POI)
  // als GPX 1.1 route met <rtept> waypoints, gesorteerd via dichtstbijzijnde-buur.
  // Startpunt: crosshair-positie indien actief, anders GPS-locatie, anders
  // meest noordwestelijke POI als fallback.
  const exportGpxRoute = useCallback(
    async ({ selCats, loc, mapCenter, crosshairActive }) => {
      // 1. Bepaal actieve categorie (eerste geselecteerde, of geen)
      const actieveCategorie = selCats && selCats.length ? selCats[0] : null;
      if (!actieveCategorie) {
        addLog("GPX route: selecteer eerst een categorie via het filter");
        return;
      }

      // 2. Filter POIs op eerste categorie
      const geselecteerd = pois.filter(
        (p) =>
          isNum(p.lat) &&
          isNum(p.lng) &&
          p.categories &&
          p.categories[0] === actieveCategorie
      );
      if (!geselecteerd.length) {
        addLog(`GPX route: geen POIs gevonden voor categorie "${actieveCategorie}"`);
        return;
      }

      // 3. Bepaal startpunt
      // Voorkeur: crosshair-positie → GPS-locatie → meest noordwestelijke POI
      let startLat, startLng;
      if (crosshairActive && mapCenter && isNum(mapCenter.lat)) {
        startLat = mapCenter.lat;
        startLng = mapCenter.lng;
        addLog(`GPX route: startpunt = crosshair (${startLat.toFixed(5)}, ${startLng.toFixed(5)})`);
      } else if (loc && isNum(loc.lat)) {
        startLat = loc.lat;
        startLng = loc.lng;
        addLog(`GPX route: startpunt = GPS-locatie`);
      } else {
        // Fallback: meest noordwestelijke POI (hoogste lat, laagste lng)
        const nw = geselecteerd.reduce((best, p) =>
          p.lat > best.lat || (p.lat === best.lat && p.lng < best.lng) ? p : best
        );
        startLat = nw.lat;
        startLng = nw.lng;
        addLog(`GPX route: startpunt = meest noordwestelijke POI (${nw.name})`);
      }

      // 4. Sorteer via dichtstbijzijnde-buur algoritme
      const gesorteerd = sorteerDichtstbijzijndeBuur(geselecteerd, startLat, startLng);

      // 5. Bouw GPX 1.1 route met <rtept> waypoints
      // Naam: alleen de POI-naam, coördinaten als WGS84 decimaal (7 decimalen)
      const rtePunten = gesorteerd
        .map(
          (p) => `  <rtept lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">
    <name>${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</name>
  </rtept>`
        )
        .join("\n");

      const routeNaam = `EuroPoi — ${actieveCategorie}`;
      const gpx = `${GPX_HEADER}
  <rte>
    <name>${routeNaam}</name>
${rtePunten}
  </rte>
</gpx>`;

      const bestandsNaam = `EuroPoi_route_${actieveCategorie}_${Date.now()}.gpx`;
      await deelBestand({
        inhoud: gpx,
        bestandsNaam,
        mimeType: "application/gpx+xml",
        titel: `EuroPoi route — ${actieveCategorie}`,
        tekst: `${gesorteerd.length} waypoints — geschikt voor Komoot, OsmAnd en andere routeplanners`,
        addLog,
      });
      addLog(`GPX route geëxporteerd: ${gesorteerd.length} waypoints (<rtept>) — "${actieveCategorie}"`);
    },
    [pois, addLog]
  );

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
    exportGpxRoute,
  };
}
