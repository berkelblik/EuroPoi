// EuroPoi — src/hooks/useLocation.js
// v1.3.0 — Native Fused Location Provider plugin (FusedLocationPlugin.java)
// Geeft op Android elke 1 seconde een update via Google Play Services FLP.
// Valt automatisch terug op standaard Capacitor Geo bij browser/Codesandbox.
import { useState, useEffect, useRef, useCallback } from "react";
import { hav, isNum } from "../geoUtils";
import { CFG } from "../config";

export function useLocation({ addLog }) {
  const [isSim, setIsSim] = useState(true);
  const [loc, setLoc] = useState(null);
  const [follow, setFollow] = useState(true);
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [navPos, setNavPos] = useState({ x: 16, y: 160 });
  const [dragging, setDragging] = useState(false);
  const [mapCenter, setMapCenter] = useState(CFG.defaultCoords);

  const [track, setTrack] = useState([]);
  const [recOn, setRecOn] = useState(false);
  const [recPause, setRecPause] = useState(false);

  const locRef = useRef(loc);
  const lastPos = useRef(null);
  const lastMove = useRef(Date.now());
  const moveInt = useRef(null);
  const dragOff = useRef({ x: 0, y: 0 });

  useEffect(() => { locRef.current = loc; }, [loc]);

  const isSimRef = useRef(true);
  useEffect(() => { isSimRef.current = isSim; }, [isSim]);

  // ── Plugin detectie ─────────────────────────────────────────────────────
  const getFlp = () => {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.FusedLocation)
      return cap.Plugins.FusedLocation;
    return null;
  };

  const getCapGeo = () => {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.Geolocation)
      return cap.Plugins.Geolocation;
    return null;
  };

  // ── Eenmalige positie bij opstart ───────────────────────────────────────
  const getCurrentPos = (onSuccess, onError) => {
    const capGeo = getCapGeo();
    if (capGeo) {
      capGeo.requestPermissions()
        .then(() => capGeo.getCurrentPosition({
          enableHighAccuracy: true, timeout: 10000,
        }))
        .then((p) => onSuccess({
          coords: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            heading: p.coords.heading || 0,
          },
        }))
        .catch(onError);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
      });
    } else {
      onError(new Error("Geen GPS beschikbaar"));
    }
  };

  // ── GPS watcher: FLP → Capacitor Geo → Browser ──────────────────────────
  const startWatching = useCallback((onPos, onErr) => {
    const flp = getFlp();
    const capGeo = getCapGeo();

    // ── Methode 1: Native FLP plugin (beste kwaliteit, elke ~1s) ──────────
    if (flp) {
      addLog && addLog("GPS: Native Fused Location Provider actief");
      let active = true;

      flp.startWatching({}, (data, err) => {
        if (!active) return;
        if (err) { onErr(err); return; }
        if (!data) return;
        onPos(data.latitude, data.longitude, data.bearing || 0);
      }).catch(onErr);

      return {
        clear: () => {
          active = false;
          flp.stopWatching({}).catch(() => {});
        },
      };
    }

    // ── Methode 2: Capacitor standaard Geo + polling heartbeat ────────────
    addLog && addLog("GPS: Capacitor Geo + heartbeat actief");
    let watchId = null;
    let heartbeat = null;
    let cancelled = false;

    const poll = () => {
      if (cancelled || !capGeo) return;
      capGeo.getCurrentPosition({ enableHighAccuracy: true, timeout: 4000 })
        .then((p) => {
          if (cancelled || isSimRef.current) return;
          onPos(p.coords.latitude, p.coords.longitude, p.coords.heading || 0);
        })
        .catch(() => {});
    };

    if (capGeo) {
      capGeo.requestPermissions()
        .then(() =>
          capGeo.watchPosition({ enableHighAccuracy: true }, (p, err) => {
            if (cancelled || isSimRef.current) return;
            if (err) { onErr(err); return; }
            onPos(p.coords.latitude, p.coords.longitude, p.coords.heading || 0);
          }).then((id) => { watchId = id; })
        ).catch(onErr);
      heartbeat = setInterval(poll, 2000);
    } else if (navigator.geolocation) {
      // Browser fallback
      addLog && addLog("GPS: Browser geolocation actief");
      const id = navigator.geolocation.watchPosition(
        (p) => {
          if (cancelled || isSimRef.current) return;
          onPos(p.coords.latitude, p.coords.longitude, p.coords.heading || 0);
        },
        onErr,
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      watchId = id;
    }

    return {
      clear: () => {
        cancelled = true;
        clearInterval(heartbeat);
        if (capGeo && watchId != null)
          capGeo.clearWatch({ id: watchId }).catch(() => {});
        else if (navigator.geolocation && watchId != null)
          navigator.geolocation.clearWatch(watchId);
      },
    };
  }, []); // eslint-disable-line

  // ── Opstart GPS ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (cancelled) return;
      addLog && addLog("GPS timeout — simulatiemodus");
      setLoc(CFG.defaultCoords);
      setIsSim(true);
    }, 8000);

    getCurrentPos(
      (p) => {
        if (cancelled) return;
        clearTimeout(fallback);
        setLoc({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: p.coords.heading || 0,
        });
        setFollow(true);
        setIsSim(false);
      },
      () => {
        if (cancelled) return;
        clearTimeout(fallback);
        addLog && addLog("GPS niet beschikbaar — simulatiemodus");
        setLoc(CFG.defaultCoords);
        setIsSim(true);
      }
    );
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // ── GPS watcher actief zodra niet in sim ────────────────────────────────
  useEffect(() => {
    if (isSim) return;
    setFollow(true);
    const watcher = startWatching(
      (lat, lng, heading) => {
        if (isSimRef.current) return;
        if (!isNum(lat) || !isNum(lng)) return;
        setLoc({ lat, lng, heading: heading || 0 });
      },
      (e) => addLog && addLog(`GPS fout: ${e.message || e}`)
    );
    return () => watcher.clear();
  }, [isSim]); // eslint-disable-line

  // ── Track opname ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recOn) {
      setRecPause(false);
      lastPos.current = null;
      return;
    }
    const iv = setInterval(() => {
      const p = locRef.current;
      if (!p || !isNum(p.lat)) return;
      if (isSimRef.current) return;
      const now = Date.now();
      if (!lastPos.current) {
        lastPos.current = p;
        setTrack((prev) => [...prev, [p.lat, p.lng]]);
        lastMove.current = now;
        return;
      }
      const d = hav(lastPos.current.lat, lastPos.current.lng, p.lat, p.lng);
      if (d > 200) { lastPos.current = p; return; }
      if (d > CFG.trackMinDist) {
        lastPos.current = p;
        lastMove.current = now;
        setTrack((prev) => [...prev, [p.lat, p.lng]]);
        setRecPause(false);
      } else {
        setRecPause(now - lastMove.current > CFG.trackPauseMs);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [recOn]);

  // ── Simulatie beweging ──────────────────────────────────────────────────
  const startMove = useCallback(
    (dLa, dLo) => {
      if (moveInt.current || !isSim) return;
      const h = dLa === 1 ? 0 : dLa === -1 ? 180 : dLo === 1 ? 90 : 270;
      moveInt.current = setInterval(
        () => setLoc((p) => ({
          lat: p.lat + dLa * 0.0001,
          lng: p.lng + dLo * 0.0001,
          heading: h,
        })), 80
      );
    }, [isSim]
  );

  const stopMove = useCallback(() => {
    clearInterval(moveInt.current);
    moveInt.current = null;
  }, []);

  return {
    isSim, setIsSim, loc, setLoc, follow, setFollow,
    crosshairActive, setCrosshairActive, navPos, setNavPos,
    dragging, setDragging, mapCenter, setMapCenter,
    track, setTrack, recOn, setRecOn, recPause,
    locRef, lastPos, lastMove, dragOff, startMove, stopMove,
  };
}
