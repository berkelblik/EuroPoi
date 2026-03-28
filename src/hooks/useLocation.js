// EuroPoi — src/hooks/useLocation.js
// GPS watcher, simulatie beweging, track opname
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

  // Track opname state
  const [track, setTrack] = useState([]);
  const [recOn, setRecOn] = useState(false);
  const [recPause, setRecPause] = useState(false);

  const locRef = useRef(loc);
  const lastPos = useRef(null);
  const lastMove = useRef(Date.now());
  const moveInt = useRef(null);
  const dragOff = useRef({ x: 0, y: 0 });

  useEffect(() => {
    locRef.current = loc;
  }, [loc]);

  // ── Eenmalig GPS bij opstart ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (navigator.geolocation) {
      const fallback = setTimeout(() => {
        if (cancelled) return;
        setLoc(CFG.defaultCoords);
        setIsSim(true);
      }, 2000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (cancelled) return;
          clearTimeout(fallback);
          setLoc({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            heading: p.coords.heading || 0,
          });
          setFollow(true);
          setTimeout(() => {
            if (!cancelled) setIsSim(true);
          }, 100);
        },
        () => {
          if (cancelled) return;
          clearTimeout(fallback);
          setLoc(CFG.defaultCoords);
          setIsSim(true);
        },
        { enableHighAccuracy: true, timeout: 2000, maximumAge: 30000 }
      );
    } else {
      setLoc(CFG.defaultCoords);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // ── GPS watcher (alleen als niet sim) ──────────────────────────────────
  useEffect(() => {
    if (isSim || !navigator.geolocation) return;
    setFollow(true);
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setLoc({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: p.coords.heading || 0,
        }),
      (e) => addLog(`GPS: ${e.message}`),
      { enableHighAccuracy: true, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [isSim, addLog]);

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
      const now = Date.now();
      if (!lastPos.current) {
        lastPos.current = p;
        setTrack((prev) => [...prev, [p.lat, p.lng]]);
        lastMove.current = now;
        return;
      }
      const d = hav(lastPos.current.lat, lastPos.current.lng, p.lat, p.lng);
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
        () =>
          setLoc((p) => ({
            lat: p.lat + dLa * 0.0001,
            lng: p.lng + dLo * 0.0001,
            heading: h,
          })),
        80
      );
    },
    [isSim]
  );

  const stopMove = useCallback(() => {
    clearInterval(moveInt.current);
    moveInt.current = null;
  }, []);

  return {
    isSim,
    setIsSim,
    loc,
    setLoc,
    follow,
    setFollow,
    crosshairActive,
    setCrosshairActive,
    navPos,
    setNavPos,
    dragging,
    setDragging,
    mapCenter,
    setMapCenter,
    track,
    setTrack,
    recOn,
    setRecOn,
    recPause,
    locRef,
    lastPos,
    lastMove,
    dragOff,
    startMove,
    stopMove,
  };
}
