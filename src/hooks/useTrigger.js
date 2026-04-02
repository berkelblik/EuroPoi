// EuroPoi — src/hooks/useTrigger.js
// Auto-trigger logica en ppois berekening
import { useMemo, useEffect, useRef } from "react";
import { hav, bear, clockDir, distToPolyline } from "../geoUtils";
import { CFG, TRANSPORT, CATEGORIES } from "../config";
import Audio$ from "../audioEngine";

export function useTrigger({
  pois,
  safeLoc,
  searchQ,
  selCats,
  transport,
  route,
  routeName,
  routeSessionId,
  triggered,
  setTriggered,
  setHighlightId,
  highlightTimer,
  poiDataRef,
  lang,
  audioMode,
  elevenCfg,
  addLog,
  t,
}) {
  const ppois = useMemo(() => {
    const defR = TRANSPORT[transport]?.radius || 100;
    const q = searchQ.toLowerCase();
    const rName = routeName.trim().toLowerCase();

    return pois
      .map((p) => {
        const directDist = hav(safeLoc.lat, safeLoc.lng, p.lat, p.lng);
        const effR = p.radius > 0 ? p.radius : defR;
        const poiCats = (p.categories || []).map((c) => c.trim().toLowerCase());
        const useRouteTrigger =
          route.length >= 2 && rName && poiCats.includes(rName);

        let dist = directDist;
        let routeEffR = effR;

        if (useRouteTrigger) {
          const { pt: triggerPt, dist: poiToRoute } = distToPolyline(
            p.lat,
            p.lng,
            route
          );
          if (triggerPt && isFinite(poiToRoute) && poiToRoute >= 0) {
            dist = hav(safeLoc.lat, safeLoc.lng, triggerPt[0], triggerPt[1]);
            routeEffR = Math.max(effR, poiToRoute + 50);
          }
        }

        return {
          ...p,
          dist,
          directDist,
          effR: routeEffR,
          useRouteTrigger,
          poiToRoute: useRouteTrigger
            ? (() => { const d = distToPolyline(p.lat, p.lng, route).dist; return isFinite(d) ? d : null; })()
            : null,
          match:
            (p.name || "").toLowerCase().includes(q) ||
            (p.pluscode || "").toLowerCase().includes(q),
          catOk:
            selCats.length === 0 ||
            p.categories?.some((c) => selCats.includes(c)),
        };
      })
      .filter((p) => p.match && p.catOk)
      .sort((a, b) => a.dist - b.dist);
  }, [pois, safeLoc, searchQ, selCats, transport, route, routeName]);

  // ── availCats ────────────────────────────────────────────────────────────
  const availCats = useMemo(() => {
    const s = new Set(CATEGORIES);
    pois.forEach((p) => p.categories?.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [pois]);

  // ── Refs voor stale-closure-vrije toegang in trigger effect ──────────────
  const triggeredRef = useRef(triggered);
  const routeSessionRef = useRef(routeSessionId);
  const routeTriggeredRef = useRef({});
  const langRef = useRef(lang);
  const audioModeRef = useRef(audioMode);
  const elevenCfgRef = useRef(elevenCfg);

  useEffect(() => {
    triggeredRef.current = triggered;
  }, [triggered]);
  useEffect(() => {
    routeSessionRef.current = routeSessionId;
  }, [routeSessionId]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    audioModeRef.current = audioMode;
  }, [audioMode]);
  useEffect(() => {
    elevenCfgRef.current = elevenCfg;
  }, [elevenCfg]);

  // ── Auto trigger effect ───────────────────────────────────────────────────
  useEffect(() => {
    const now = Date.now();
    const _triggered = triggeredRef.current;
    const _lang = langRef.current;
    const _mode = audioModeRef.current;
    const _eleven = elevenCfgRef.current;
    const _session = routeSessionRef.current;

    // Verzamel alle POI's die binnen radius vallen en nog niet getriggerd zijn.
    // De eerste speelt direct; de rest komt via de Audio$-wachtrij zodat ze
    // naadloos achter elkaar worden voorgedragen.
    const tgts = ppois.filter((p) => {
      if (p.dist > p.effR) return false;
      if (p.useRouteTrigger) {
        return routeTriggeredRef.current[p.id] !== _session;
      }
      return now - (_triggered[p.id] || 0) > CFG.cooldownMs;
    });

    if (tgts.length === 0) return;

    // Markeer alle kandidaten meteen als getriggerd zodat een volgende
    // GPS-cycle ze niet nogmaals toevoegt.
    setTriggered((prev) => {
      const next = { ...prev };
      tgts.forEach((p) => {
        next[p.id] = now;
      });
      return next;
    });
    tgts.forEach((p) => {
      if (p.useRouteTrigger) routeTriggeredRef.current[p.id] = _session;
    });

    // Highlight de eerste (dichtstbijzijnde) POI
    const first = tgts[0];
    setHighlightId(first.id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);

    tgts.forEach((tgt, i) => {
      const txt = t.announce(
        tgt.name,
        tgt.dist,
        clockDir(
          safeLoc.heading || 0,
          bear(safeLoc.lat, safeLoc.lng, tgt.lat, tgt.lng)
        )
      );
      const raw = poiDataRef.current[tgt.id] || {};
      addLog(
        `raw: bulk=${typeof raw.audioBulk}/${
          raw.audioBulk === true ? "TRUE" : !!raw.audioBulk
        } data=${typeof raw.audioData}/${
          raw.audioData === true ? "TRUE" : !!raw.audioData
        } url=${!!tgt.audioUrl}`
      );
      const opts = {
        audioUrl: tgt.audioUrl,
        audioBulk: raw.audioBulk,
        audioData: raw.audioData,
        elevenCfg: _eleven,
        lang: _lang,
        mode: _mode,
        poiName: tgt.name,
        waitMsg: `Straks meer over ${tgt.name}`,
      };

      const promise = Audio$.announceAndPlay(
        txt,
        tgt.desc?.trim() || tgt.name,
        opts
      );

      // Na afloop van de laatste in de reeks: highlight wissen
      if (i === tgts.length - 1) {
        promise.finally(() => {
          highlightTimer.current = setTimeout(() => setHighlightId(null), 3000);
        });
      }

      addLog(`Trigger: ${tgt.name}${i > 0 ? " (wachtrij)" : ""}`);
    });
  }, [ppois]);

  return { ppois, availCats };
}
