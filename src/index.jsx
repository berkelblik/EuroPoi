// EuroPoi v1.0.0 — src/index.jsx
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Settings,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  Target,
  GripHorizontal,
  Volume2,
  VolumeX,
  Map as MapIcon,
  Ban,
  Leaf,
  Route,
  MessageSquare,
  XCircle,
  Key,
  Signal,
  WifiOff,
  Crosshair,
} from "lucide-react";

import { CFG, Z } from "./config";
import { getT } from "./translations";
import DB from "./db";
import Audio$ from "./audioEngine";
import { isNum, uid, pinFrom, encPlus } from "./geoUtils";

import LeafletMap from "./components/LeafletMap";
import EcoScreen from "./components/EcoScreen";
import { Sheet, Confirm, PushBtn, PoiCard } from "./components/UI";
import AboutSheet from "./components/sheets/AboutSheet";
import SettingsSheet from "./components/sheets/SettingsSheet";
import EditPoiSheet from "./components/sheets/EditPoiSheet";
import RouteSheet from "./components/sheets/RouteSheet";

import { useLocation } from "./hooks/useLocation";
import { useGpx } from "./hooks/useGpx";
import { useTrigger } from "./hooks/useTrigger";
import { useAudio } from "./hooks/useAudio";

export default function App() {
  // ── UI staat ─────────────────────────────────────────────────────────────
  const [init, setInit] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [editPoi, setEditPoi] = useState(null);
  const [confirm, setConfirm] = useState({
    open: false,
    title: "",
    msg: "",
    onOk: () => {},
  });
  const [showMap, setShowMap] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [selCats, setSelCats] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);

  // ── Instellingen ─────────────────────────────────────────────────────────
  const [lang, setLang] = useState("nl-NL");
  const [transport, setTransport] = useState("Fietser");
  const [tileKey, setTileKey] = useState("osm");
  const [audioMode, setAudioMode] = useState("full");
  const [elevenCfg, setElevenCfg] = useState(() => {
    try {
      return {
        voiceId: "AVIlLDn2TVmdaDycgbo3",
        ...JSON.parse(localStorage.getItem("pp_el") || "{}"),
      };
    } catch {
      return { voiceId: "AVIlLDn2TVmdaDycgbo3" };
    }
  });
  const [userId] = useState(() => {
    const s = localStorage.getItem("pp_uid");
    if (s) return s;
    const id = `PP-${uid().split("-")[0].toUpperCase()}`;
    localStorage.setItem("pp_uid", id);
    return id;
  });
  const [adminMode, setAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState("");

  // ── POI staat ─────────────────────────────────────────────────────────────
  const [pois, setPois] = useState([]);
  const [triggered, setTriggered] = useState({});
  const [tick, setTick] = useState(Date.now());
  const [speaking, setSpeaking] = useState(false);

  // ── Systeem staat ─────────────────────────────────────────────────────────
  const [ecoMode, setEcoMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [scriptsOk, setScriptsOk] = useState(false);
  const [logs, setLogs] = useState([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const taps = useRef(0),
    tapTimer = useRef(null);
  const wakeLock = useRef();
  const poiListRef = useRef(null),
    cardRefs = useRef({});
  const csvRef = useRef(),
    audioIndivRef = useRef(),
    bulkRef = useRef();
  const photoRef = useRef(),
    gpxRef = useRef();
  const poiDataRef = useRef({});

  const t = useMemo(() => getT(lang), [lang]);

  const addLog = useCallback((msg) => {
    const s = typeof msg === "object" ? JSON.stringify(msg) : String(msg);
    setLogs((p) =>
      [`[${new Date().toLocaleTimeString()}] ${s}`, ...p].slice(0, 80)
    );
    // Toon relevante berichten in debug overlay
  }, []);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    isSim,
    setIsSim,
    loc,
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
    dragOff,
    startMove,
    stopMove,
  } = useLocation({ addLog });

  const {
    route,
    setRoute,
    routeName,
    setRouteName,
    routeSessionId,
    gpxWarn,
    setGpxWarn,
    acceptGpxTrack,
    bulkStatus,
    exportCSV,
    importCSV,
    importBulk,
    loadGpx,
    saveTrack,
  } = useGpx({ pois, setPois, addLog, setTriggered, track });

  const safeLoc = loc || CFG.defaultCoords;

  const { ppois, availCats } = useTrigger({
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
  });

  const { speakPoi } = useAudio({
    pois,
    poiDataRef,
    elevenCfg,
    lang,
    audioMode,
    crosshairActive,
    setCrosshairActive,
    setFollow,
    setHighlightId,
    highlightTimer,
    addLog,
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Audio$.onSpeak(setSpeaking);
    // Native plugin checks en statusbalk verbergen bij opstart
    setTimeout(() => {
      const cap = window.Capacitor;
      const isNative =
        cap &&
        typeof cap.isNativePlatform === "function" &&
        cap.isNativePlatform();

      // StatusBar verbergen in APK
      if (isNative) {
        try {
          cap.Plugins?.StatusBar?.hide?.();
          cap.Plugins?.StatusBar?.setOverlaysWebView?.({ overlay: true });
        } catch (_) {}
        try {
          cap.Plugins?.NavigationBar?.hide?.();
        } catch (_) {}
      }

      const hasTTS = !!cap?.Plugins?.TextToSpeech;
      const hasGeo = !!cap?.Plugins?.Geolocation;
      addLog(
        `Platform: ${isNative ? "Native Android" : "Browser"} | TTS: ${
          hasTTS ? "OK" : "ONTBREEKT"
        } | Geo: ${hasGeo ? "OK" : "ONTBREEKT"}`
      );
    }, 1000);
    Audio$.setLog((msg) => {
      const s = String(msg || "");
      const safe =
        s.includes("base64") || s.length > 200
          ? s.slice(0, 120) + "… [ingekort]"
          : s;
      setLogs((p) =>
        [`[${new Date().toLocaleTimeString()}] 🔊 ${safe}`, ...p].slice(0, 80)
      );
    });
    DB.getAll()
      .then((rawPois) => {
        const valid = rawPois.filter((p) => isNum(p.lat));
        valid.forEach((p) => {
          poiDataRef.current[p.id] = {
            audioBulk: p.audioBulk,
            audioData: p.audioData,
          };
        });
        setPois(
          valid.map((p) => ({
            ...p,
            audioBulk: p.audioBulk ? true : null,
            audioData: p.audioData ? true : null,
          }))
        );
      })
      .catch(() => {});

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setScriptsOk(true);
    document.head.appendChild(script);
    window.speechSynthesis?.getVoices();
    window.speechSynthesis &&
      (window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices());

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener(
      "click",
      () => {
        // AudioContext ontgrendelen
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const c = new AC();
          c.state === "suspended" && c.resume();
        }
        // SpeechSynthesis ontgrendelen voor Android WebView:
        // een lege utterance tijdens een gebruikersinteractie activeert de stem-engine
        if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance("");
          u.volume = 0;
          window.speechSynthesis.speak(u);
          window.speechSynthesis.cancel();
        }
      },
      { once: true }
    );
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // ── Wake lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ecoMode && "wakeLock" in navigator)
      navigator.wakeLock
        .request("screen")
        .then((wl) => {
          wakeLock.current = wl;
        })
        .catch(() => {});
    return () => {
      wakeLock.current?.release();
      wakeLock.current = null;
    };
  }, [ecoMode]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    try {
      const p =
        document.documentElement.requestFullscreen?.() ||
        document.documentElement.webkitRequestFullscreen?.();
      p?.catch?.(() => {});
    } catch (_) {}
  }, []);
  const exitFullscreen = useCallback(() => {
    try {
      const p =
        document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      p?.catch?.(() => {});
    } catch (_) {}
  }, []);
  useEffect(() => {
    const onFs = () => {
      if (
        !(document.fullscreenElement || document.webkitFullscreenElement) &&
        ecoMode
      )
        setEcoMode(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, [ecoMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleEco = useCallback(() => {
    if (!ecoMode) {
      // Eco-mode vereist GPS — schakel Simulatie automatisch uit
      setIsSim(false);
      enterFullscreen();
      setEcoMode(true);
    } else {
      exitFullscreen();
      setEcoMode(false);
    }
  }, [ecoMode, enterFullscreen, exitFullscreen, setIsSim]);

  const onLogoTap = () => {
    taps.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (taps.current >= 3) {
      setSheet("pin");
      taps.current = 0;
    } else
      tapTimer.current = setTimeout(() => {
        taps.current = 0;
      }, 1000);
  };

  const handleMapPoiClick = useCallback(
    (p) => {
      speakPoi(p);
      setTimeout(() => {
        const el = cardRefs.current[p.id];
        if (el && poiListRef.current)
          el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 10000);
    },
    [speakPoi]
  );

  const activePos = follow ? safeLoc : mapCenter;

  // ── SPLASH ────────────────────────────────────────────────────────────────
  if (!init)
    return (
      <div
        className="absolute inset-0 bg-[#020a1a] flex flex-col items-center justify-center p-8 text-center cursor-pointer select-none"
        onClick={() => setInit(true)}
      >
        <div className="w-44 h-44 mb-8 rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(59,130,246,.4)] border-4 border-blue-500/30">
          <img
            src="/EuroPoiLogo.png"
            alt="EuroPoi"
            className="w-full h-full object-cover"
          />
        </div>
        <h1
          className="text-white font-black text-3xl italic tracking-tighter mb-1"
          style={{ fontFamily: "Georgia,'Times New Roman',serif" }}
        >
          Daar heb je een punt.
        </h1>
        <p className="text-blue-400/80 font-semibold italic text-sm mb-12 whitespace-pre-line leading-relaxed">
          {t.motto}
        </p>
        <p className="text-blue-500 font-black uppercase tracking-[.35em] text-[10px] animate-pulse">
          TAP TO START
        </p>
        <div className="absolute bottom-8 text-slate-600 text-[9px] font-mono text-center leading-loose">
          <div>{CFG.version}</div>
          <div>Ontwerp: Peter Drukker &copy; 2026</div>
        </div>
      </div>
    );

  // ── HOOFD RENDER ──────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0 bg-slate-950 flex flex-col overflow-hidden select-none text-white"
      style={{ fontFamily: "system-ui,sans-serif" }}
    >
      {/* HEADER */}
      <header
        className="h-14 px-3 flex items-center justify-between shrink-0 shadow-xl bg-[#0a1628] border-b border-blue-900/60"
        style={{ zIndex: Z.toolbar + 20 }}
      >
        <div
          className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform"
          onClick={onLogoTap}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg pointer-events-none border border-white/20">
            <img
              src="/EuroPoiLogo.png"
              alt="EuroPoi"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col pointer-events-none">
            <span className="font-black italic tracking-tighter text-lg leading-none">
              {CFG.appName}
            </span>
            <span className="text-[8px] font-bold text-blue-400/70">
              {CFG.version}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="flex items-center gap-1 bg-orange-900/60 border border-orange-600/40 px-2 py-0.5 rounded-full">
              <WifiOff size={9} className="text-orange-400" />
              <span className="text-[7px] font-black uppercase text-orange-400">
                {t.offline}
              </span>
            </div>
          )}
          <button
            onClick={() => setSheet("about")}
            className="w-9 h-9 flex items-center justify-center"
            style={{
              fontFamily: "Georgia,'Times New Roman',serif",
              color: "white",
              fontSize: "20px",
              fontStyle: "italic",
              fontWeight: "900",
              lineHeight: 1,
            }}
          >
            i
          </button>
          <div
            className={`flex items-center gap-1.5 text-[9px] font-black uppercase ${
              isSim ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            <Signal size={11} />
            <span>{isSim ? t.sim : t.gpsLive}</span>
          </div>
        </div>
      </header>

      {/* STOP SPRAAK */}
      {speaking && (
        <div
          className="absolute top-[3.6rem] left-1/2 -translate-x-1/2"
          style={{ zIndex: Z.speech }}
        >
          <button
            onClick={() => Audio$.stop()}
            className="bg-red-600 text-white font-black uppercase text-[9px] px-4 py-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,.5)] flex items-center gap-1.5 border border-white/20 active:scale-95 transition-transform"
          >
            <XCircle size={13} className="animate-pulse" /> {t.stopSpeech}
          </button>
        </div>
      )}

      {/* COÖRDINATEN BALK */}
      <div
        className={`h-7 flex items-center justify-between px-3 shrink-0 text-[8px] font-mono transition-colors ${
          crosshairActive ? "bg-amber-900/70" : "bg-blue-950/80"
        }`}
        style={{ zIndex: Z.coords }}
      >
        <div className="flex items-center gap-1.5 text-blue-300/80">
          {crosshairActive ? (
            <Crosshair size={9} className="text-amber-300" />
          ) : (
            <Target size={9} className="text-blue-400" />
          )}
          {activePos.lat.toFixed(6)} &middot; {activePos.lng.toFixed(6)}
        </div>
        <div className="flex items-center gap-2">
          {crosshairActive && (
            <span className="text-amber-200 font-black uppercase text-[7px] tracking-widest animate-pulse">
              ✛ SLEEP KAART · DRUK + POI
            </span>
          )}
          <div className="text-yellow-400 font-black tracking-widest">
            {encPlus(activePos.lat, activePos.lng)}
          </div>
        </div>
      </div>

      {/* WERKBALK */}
      <div
        className="h-16 bg-[#0a1628] border-b border-blue-950 flex items-center justify-around px-2 gap-1.5 shrink-0"
        style={{ zIndex: Z.toolbar }}
      >
        <button
          onClick={() => setIsSim(!isSim)}
          style={{ touchAction: "none" }}
          className={`h-11 flex-1 max-w-[72px] rounded-2xl text-[9px] font-black uppercase flex items-center justify-center transition-all touch-none
            ${
              isSim
                ? "bg-amber-200 text-amber-900 shadow-[0_5px_0_#92400e,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#92400e] active:translate-y-[3px]"
                : "bg-emerald-200 text-emerald-900 shadow-[0_5px_0_#065f46,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#065f46] active:translate-y-[3px]"
            }`}
        >
          {isSim ? "SIM" : "GPS"}
        </button>
        <button
          onClick={() => {
            const next = !crosshairActive;
            setCrosshairActive(next);
            setFollow(!next);
          }}
          style={{ touchAction: "none" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none
            ${
              crosshairActive
                ? "bg-amber-100 shadow-[0_5px_0_#92400e,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#92400e] active:translate-y-[3px]"
                : "bg-white/90 shadow-[0_5px_0_#0369a1,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#0369a1] active:translate-y-[3px]"
            }`}
        >
          <Crosshair
            size={18}
            className={crosshairActive ? "text-amber-600" : "text-sky-500"}
          />
        </button>
        <button
          onClick={() => setShowMap((v) => !v)}
          style={{ touchAction: "none" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none
            ${
              showMap
                ? "bg-white/90 shadow-[0_5px_0_#5b21b6,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#5b21b6] active:translate-y-[3px]"
                : "bg-slate-200 shadow-[0_5px_0_#1e293b,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#1e293b] active:translate-y-[3px]"
            }`}
        >
          <MapIcon
            size={18}
            className={showMap ? "text-violet-600" : "text-slate-400"}
          />
        </button>
        <button
          onClick={() => setSheet("route")}
          style={{ touchAction: "none" }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none bg-white/90 shadow-[0_5px_0_#0f766e,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#0f766e] active:translate-y-[3px]"
        >
          <Route size={18} className="text-teal-600" />
        </button>
        <button
          onClick={toggleEco}
          style={{ touchAction: "none" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none
            ${
              ecoMode
                ? "bg-green-100 shadow-[0_5px_0_#14532d,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#14532d] active:translate-y-[3px]"
                : "bg-white/90 shadow-[0_5px_0_#166534,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#166534] active:translate-y-[3px]"
            }`}
        >
          <Leaf
            size={18}
            className={ecoMode ? "text-green-700" : "text-green-500"}
          />
        </button>
        <button
          onClick={() => setSheet("settings")}
          style={{ touchAction: "none" }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none bg-white/90 shadow-[0_5px_0_#1e40af,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#1e40af] active:translate-y-[3px]"
        >
          <Settings size={18} className="text-blue-500" />
        </button>
        <button
          onClick={() =>
            setAudioMode((m) =>
              m === "full" ? "concise" : m === "concise" ? "silent" : "full"
            )
          }
          style={{ touchAction: "none" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all touch-none
            ${
              audioMode === "full"
                ? "bg-white/90 shadow-[0_5px_0_#6b21a8,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#6b21a8] active:translate-y-[3px]"
                : audioMode === "concise"
                ? "bg-orange-50 shadow-[0_5px_0_#9a3412,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#9a3412] active:translate-y-[3px]"
                : "bg-slate-200 shadow-[0_5px_0_#1e293b,0_6px_8px_rgba(0,0,0,.45)] active:shadow-[0_2px_0_#1e293b] active:translate-y-[3px]"
            }`}
        >
          {audioMode === "full" ? (
            <Volume2 size={18} className="text-purple-600" />
          ) : audioMode === "concise" ? (
            <MessageSquare size={18} className="text-orange-600" />
          ) : (
            <VolumeX size={18} className="text-slate-400" />
          )}
        </button>
      </div>

      {/* KAART */}
      <div
        className="relative shrink-0 overflow-hidden transition-all duration-500 ease-in-out"
        style={{
          height: crosshairActive ? "380px" : showMap ? "280px" : "0px",
          zIndex: Z.map,
        }}
      >
        <LeafletMap
          loc={safeLoc}
          follow={follow}
          setCenter={setMapCenter}
          tileKey={tileKey}
          setTileKey={setTileKey}
          pois={ppois}
          route={route}
          track={track}
          ready={scriptsOk}
          onPoiClick={handleMapPoiClick}
          highlightId={highlightId}
          crosshairActive={crosshairActive}
          t={t}
        />
      </div>

      {/* ACTIE BALK */}
      <div
        className="bg-[#0a1628] px-2.5 pt-2 pb-2 flex flex-col gap-2 shrink-0 border-t border-blue-900/40"
        style={{ zIndex: Z.actionbar }}
      >
        <div className="flex gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-xl px-2.5 py-1.5">
            <Search size={12} className="text-white/40 shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={t.search}
              className="flex-1 bg-transparent outline-none text-white text-[11px] placeholder-white/25 font-medium"
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")}>
                <X size={11} className="text-white/30" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_4px_0_rgba(0,0,0,.4)] active:shadow-none active:translate-y-1 transition-all
              ${
                filterOpen || selCats.length
                  ? "bg-amber-300 text-amber-900 shadow-[0_4px_0_#92400e]"
                  : "bg-slate-600 text-slate-200 shadow-[0_4px_0_#0f172a]"
              }`}
          >
            <Filter size={16} />
          </button>
        </div>
        {filterOpen && (
          <div className="flex flex-col gap-2 bg-black/40 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest">
                Categorie filter
              </span>
              {selCats.length > 0 && (
                <button
                  onClick={() => setSelCats([])}
                  className="flex items-center gap-1 text-[8px] font-black uppercase text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full"
                >
                  <X size={8} /> Wis ({selCats.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availCats.map((c) => {
                const count = ppois.filter((p) =>
                  p.categories?.includes(c)
                ).length;
                return (
                  <button
                    key={c}
                    onClick={() =>
                      setSelCats((p) =>
                        p.includes(c) ? p.filter((x) => x !== c) : [...p, c]
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border transition-all flex items-center gap-1
                      ${
                        selCats.includes(c)
                          ? "bg-blue-600 text-white border-blue-400 shadow-[0_2px_0_#1e3a8a]"
                          : "bg-white/8 text-white/60 border-white/15 pp-hover-bright"
                      }`}
                  >
                    {c}
                    {count > 0 && (
                      <span
                        className={`text-[7px] font-black px-1 rounded-full ${
                          selCats.includes(c) ? "bg-blue-400/40" : "bg-white/15"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-1.5">
          <button
            className={`flex-1 h-10 text-[10px] font-black uppercase rounded-2xl flex items-center justify-center gap-1 transition-all
              ${
                !follow
                  ? "bg-amber-300 text-amber-900 shadow-[0_5px_0_#92400e,0_6px_8px_rgba(0,0,0,.4)] active:shadow-[0_2px_0_#92400e] active:translate-y-[3px] ring-2 ring-amber-400 ring-offset-1 ring-offset-[#0a1628]"
                  : "bg-yellow-200 text-yellow-900 shadow-[0_5px_0_#854d0e,0_6px_8px_rgba(0,0,0,.4)] active:shadow-[0_2px_0_#854d0e] active:translate-y-[3px]"
              }`}
            onClick={() => {
              setEditPoi({
                id: uid(),
                lat: activePos.lat,
                lng: activePos.lng,
                name: "POI",
                desc: "",
                categories: ["Overig"],
                radius: 0,
                pluscode: encPlus(activePos.lat, activePos.lng),
                audioUrl: "",
              });
              setCrosshairActive(false);
              setFollow(true);
            }}
          >
            {!follow ? <Crosshair size={13} /> : null}
            {t.addPoi}
          </button>
          <button
            className="flex-1 h-10 text-[10px] font-black uppercase rounded-2xl flex items-center justify-center gap-1 bg-sky-200 text-sky-900 shadow-[0_5px_0_#0369a1,0_6px_8px_rgba(0,0,0,.4)] active:shadow-[0_2px_0_#0369a1] active:translate-y-[3px] transition-all"
            onClick={() => csvRef.current?.click()}
          >
            {t.import}
          </button>
          {adminMode && (
            <button
              className="flex-1 h-10 text-[10px] font-black uppercase rounded-2xl flex items-center justify-center gap-1 bg-indigo-200 text-indigo-900 shadow-[0_5px_0_#3730a3,0_6px_8px_rgba(0,0,0,.4)] active:shadow-[0_2px_0_#3730a3] active:translate-y-[3px] transition-all"
              onClick={() => exportCSV(ppois)}
            >
              {t.export}
            </button>
          )}
          <button
            className="flex-1 h-10 text-[10px] font-black uppercase rounded-2xl flex items-center justify-center gap-1 bg-rose-200 text-rose-900 shadow-[0_5px_0_#9f1239,0_6px_8px_rgba(0,0,0,.4)] active:shadow-[0_2px_0_#9f1239] active:translate-y-[3px] transition-all"
            onClick={() =>
              setConfirm({
                open: true,
                title: t.clear,
                msg: t.clearDb,
                onOk: async () => {
                  await DB.clearAll();
                  setPois([]);
                  addLog("DB gewist");
                },
              })
            }
          >
            {t.clear}
          </button>
        </div>
      </div>

      {/* POI LIJST */}
      <div
        ref={poiListRef}
        className="overflow-y-auto bg-[#F3E5AB] pt-3 pb-6"
        style={{ zIndex: Z.poilist, maxHeight: "276px" }}
      >
        {ppois.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 opacity-30 text-slate-600">
            <Ban size={44} />
            <p className="text-[10px] font-black uppercase mt-2 tracking-widest">
              {t.noPois}
            </p>
          </div>
        ) : (
          ppois.map((p) => (
            <PoiCard
              key={p.id}
              poi={p}
              t={t}
              elevenCfg={elevenCfg}
              cooldown={tick - (triggered[p.id] || 0) < CFG.cooldownMs}
              highlight={highlightId === p.id}
              cardRef={(el) => {
                cardRefs.current[p.id] = el;
              }}
              onEdit={setEditPoi}
              onDelete={async (id) => {
                await DB.remove(id);
                setPois((prev) => prev.filter((x) => x.id !== id));
              }}
              onSpeak={speakPoi}
            />
          ))
        )}
      </div>

      {/* SIMULATIE NAV PAD */}
      {isSim && (
        <div
          style={{
            left: navPos.x,
            top: navPos.y,
            touchAction: "none",
            zIndex: Z.navpad,
          }}
          className="absolute flex flex-col items-center bg-white/40 backdrop-blur-xl p-2.5 rounded-[2.5rem] shadow-2xl border border-white/20"
        >
          <div
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId);
              dragOff.current = {
                x: e.clientX - navPos.x,
                y: e.clientY - navPos.y,
              };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (dragging)
                setNavPos({
                  x: e.clientX - dragOff.current.x,
                  y: e.clientY - dragOff.current.y,
                });
            }}
            onPointerUp={() => setDragging(false)}
            className="w-full flex justify-center py-1 -mt-1 mb-1 cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal className="text-slate-500/50" size={16} />
          </div>
          <button
            onPointerDown={() => startMove(1, 0)}
            onPointerUp={stopMove}
            className="w-9 h-9 bg-slate-900 text-white rounded-xl shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 flex items-center justify-center transition-all"
          >
            <ArrowUp size={18} />
          </button>
          <div className="flex gap-2.5 my-2">
            <button
              onPointerDown={() => startMove(0, -1)}
              onPointerUp={stopMove}
              className="w-9 h-9 bg-slate-900 text-white rounded-xl shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 flex items-center justify-center transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onPointerDown={() => startMove(0, 1)}
              onPointerUp={stopMove}
              className="w-9 h-9 bg-slate-900 text-white rounded-xl shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 flex items-center justify-center transition-all"
            >
              <ArrowRight size={18} />
            </button>
          </div>
          <button
            onPointerDown={() => startMove(-1, 0)}
            onPointerUp={stopMove}
            className="w-9 h-9 bg-slate-900 text-white rounded-xl shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 flex items-center justify-center transition-all"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      )}

      {/* ECO SCHERM */}
      {ecoMode && (
        <EcoScreen
          ppois={ppois}
          loc={safeLoc}
          tick={tick}
          onClose={toggleEco}
        />
      )}

      {/* SHEETS */}
      <AboutSheet
        open={sheet === "about"}
        onClose={() => setSheet(null)}
        t={t}
        logs={logs}
      />

      <Sheet
        open={sheet === "pin"}
        onClose={() => {
          setSheet(null);
          setPinInput("");
        }}
        title={t.pin}
      >
        <div className="space-y-4 text-center pb-4">
          <Key size={36} className="mx-auto text-amber-400" />
          <p className="text-white/50 text-[10px]">
            ID: <span className="font-mono text-blue-300">{userId}</span>
          </p>
          <p className="text-white/30 text-[9px]">{t.pinHint}</p>
          <input
            type="tel"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-black/40 border-2 border-white/10 p-4 rounded-2xl text-center text-3xl font-black tracking-[1em] text-white outline-none focus:border-amber-400 transition-colors"
          />
          <PushBtn
            cls="w-full py-3.5 bg-amber-500 text-black border-amber-700 text-sm"
            onClick={() => {
              const ok = pinInput === pinFrom(userId);
              setAdminMode(ok);
              addLog(ok ? t.adminOn : t.adminOff);
              setSheet(null);
              setPinInput("");
            }}
          >
            {t.confirm}
          </PushBtn>
        </div>
      </Sheet>

      <SettingsSheet
        open={sheet === "settings"}
        onClose={() => setSheet(null)}
        t={t}
        userId={userId}
        adminMode={adminMode}
        transport={transport}
        setTransport={setTransport}
        lang={lang}
        setLang={setLang}
        elevenCfg={elevenCfg}
        setElevenCfg={setElevenCfg}
        bulkStatus={bulkStatus}
        onBulkClick={() => bulkRef.current?.click()}
        logs={logs}
        setLogs={setLogs}
        addLog={addLog}
      />

      <EditPoiSheet
        editPoi={editPoi}
        setEditPoi={setEditPoi}
        setPois={setPois}
        availCats={availCats}
        addLog={addLog}
        onAudioBrowse={() => audioIndivRef.current?.click()}
        onPhotoBrowse={() => photoRef.current?.click()}
        onSaveRaw={(id, raw) => {
          poiDataRef.current[id] = raw;
        }}
        t={t}
      />

      <RouteSheet
        open={sheet === "route"}
        onClose={() => setSheet(null)}
        t={t}
        route={route}
        setRoute={setRoute}
        routeName={routeName}
        setRouteName={setRouteName}
        track={track}
        setTrack={setTrack}
        recOn={recOn}
        setRecOn={setRecOn}
        recPause={recPause}
        gpxWarn={gpxWarn}
        setGpxWarn={setGpxWarn}
        acceptGpxTrack={acceptGpxTrack}
        onGpxClick={() => gpxRef.current?.click()}
        saveTrack={saveTrack}
        addLog={addLog}
      />

      <Confirm
        open={confirm.open}
        onClose={() => setConfirm((p) => ({ ...p, open: false }))}
        title={confirm.title}
        msg={confirm.msg}
        onOk={confirm.onOk}
        t={t}
      />

      {/* VERBORGEN FILE INPUTS */}
      <input
        ref={csvRef}
        type="file"
        className="hidden"
        accept=".csv"
        onChange={importCSV}
      />
      <input
        ref={bulkRef}
        type="file"
        className="hidden"
        multiple
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        onChange={importBulk}
      />
      <input
        ref={audioIndivRef}
        type="file"
        className="hidden"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        onChange={(e) => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onloadend = () =>
            setEditPoi((p) => ({
              ...p,
              audioData: r.result,
              audioFileName: f.name,
              audioUrl: "",
            }));
          r.readAsDataURL(f);
          e.target.value = "";
        }}
      />
      <input
        ref={photoRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onloadend = () =>
            setEditPoi((p) => ({ ...p, imageData: r.result }));
          r.readAsDataURL(f);
          e.target.value = "";
        }}
      />
      <input
        ref={gpxRef}
        type="file"
        className="hidden"
        accept=".gpx"
        onChange={loadGpx}
      />

      <style>{`
        body { overscroll-behavior: none; }
        .leaflet-container { background: #1e293b; }
        @media (hover: hover) {
          .pp-hoverable:hover    { opacity: 0.85; }
          .pp-hover-blue:hover   { color: #93c5fd; }
          .pp-hover-bright:hover { background-color: rgba(255,255,255,0.12); }
          .pp-hover-poi:hover    { background-color: #112250; }
          .pp-hover-drag:hover   { background-color: #60a5fa; }
        }
      `}</style>
    </div>
  );
}
