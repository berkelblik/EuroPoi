import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Z } from "../config";
import { relAng, clockDir, bear } from "../geoUtils";

const BELL_URL = "/bike-bell-40094.mp3";

// ── Wikipedia taal mapping ─────────────────────────────────────────────────
const WIKI_LANG = {
  "nl-NL": "nl", "nl": "nl",
  "en-GB": "en", "en-US": "en", "en": "en",
  "de-DE": "de", "de": "de",
  "fr-FR": "fr", "fr": "fr",
  "es-ES": "es", "es": "es",
  "it-IT": "it", "it": "it",
};

// ── Wikipedia API zoeken ───────────────────────────────────────────────────
async function zoekWikipedia(naam, lang) {
  const wl = WIKI_LANG[lang] || "nl";
  try {
    // Zoek eerst op exacte naam
    const zoekUrl = `https://${wl}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(naam)}&srlimit=1&format=json&origin=*`;
    const zoekRes = await fetch(zoekUrl);
    const zoekData = await zoekRes.json();
    const hits = zoekData?.query?.search;
    if (!hits || hits.length === 0) return null;

    const pagina = hits[0].title;

    // Haal de samenvatting op
    const extractUrl = `https://${wl}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pagina)}&format=json&origin=*`;
    const extractRes = await fetch(extractUrl);
    const extractData = await extractRes.json();
    const pages = extractData?.query?.pages;
    const page = pages ? Object.values(pages)[0] : null;
    if (!page || !page.extract) return null;

    // Eerste zin van de samenvatting (max 300 tekens)
    const extract = page.extract.split("\n")[0].slice(0, 350);
    const wikiUrl = `https://${wl}.wikipedia.org/wiki/${encodeURIComponent(pagina)}`;

    return { titel: pagina, extract, url: wikiUrl };
  } catch {
    return null;
  }
}

const EcoScreen = ({ ppois, loc, tick, onClose, lang }) => {
  const activePoi = useMemo(
    () => ppois.find((p) => p.dist <= p.effR) || null,
    [ppois, tick]
  );
  const angle = activePoi ? relAng(loc, activePoi) : 0;
  const distM = activePoi ? Math.round(activePoi.dist) : 0;
  const clk = activePoi
    ? clockDir(
        loc.heading || 0,
        bear(loc.lat, loc.lng, activePoi.lat, activePoi.lng)
      )
    : 0;

  const bellRef = useRef(null);
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  // ── Wikipedia state ────────────────────────────────────────────────────
  const [wikiInfo, setWikiInfo] = useState(null);      // { titel, extract, url }
  const [wikiZoeken, setWikiZoeken] = useState(false); // bezig met zoeken
  const [wikiPaneel, setWikiPaneel] = useState(false); // paneel open
  const vorigePoiId = useRef(null);

  // Zoek Wikipedia zodra een nieuwe POI actief wordt
  useEffect(() => {
    if (!activePoi) {
      // POI verlaten — verberg de "beschikbaar" tekst maar laat paneel open
      setWikiInfo(null);
      setWikiZoeken(false);
      vorigePoiId.current = null;
      return;
    }
    if (activePoi.id === vorigePoiId.current) return; // zelfde POI, niet opnieuw zoeken
    vorigePoiId.current = activePoi.id;
    setWikiInfo(null);
    setWikiPaneel(false);

    // Gebruik handmatige URL als die in het CSV staat
    if (activePoi.wikiUrl) {
      setWikiInfo({ titel: activePoi.name, extract: null, url: activePoi.wikiUrl });
      return;
    }

    // Automatisch zoeken
    setWikiZoeken(true);
    zoekWikipedia(activePoi.name, lang || "nl-NL").then((result) => {
      setWikiZoeken(false);
      if (result) setWikiInfo(result);
    });
  }, [activePoi?.id, lang]);

  const ringBell = () => {
    try {
      const audio = new window.Audio(BELL_URL);
      audio.volume = 1.0;
      audio.play().catch((err) => console.warn("Bel fout:", err));
      bellRef.current = audio;
    } catch (err) {
      console.warn("Bel error:", err);
    }
  };

  // 1x tikken = bel; 3x snel tikken = sluiten
  const handleTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      onClose();
      return;
    }
    tapTimer.current = setTimeout(() => {
      if (tapCount.current === 1) ringBell();
      tapCount.current = 0;
    }, 400);
  };

  return (
    <div
      onClick={handleTap}
      className="absolute inset-0 bg-black flex items-center justify-center"
      style={{ zIndex: Z.eco }}
    >
      {activePoi && (
        <div className="flex flex-col items-center gap-6 px-8 w-full">
          {/* Kompas */}
          <div className="relative w-64 h-64 rounded-full border-4 border-blue-900 bg-[#050d1a] shadow-[0_0_60px_rgba(59,130,246,.3)] flex items-center justify-center">
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
              (deg) => (
                <div
                  key={deg}
                  className="absolute w-full h-full flex justify-center"
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  <div
                    className={`w-px mt-2 ${
                      deg % 90 === 0 ? "h-5 bg-blue-400" : "h-2.5 bg-blue-900"
                    }`}
                  />
                </div>
              )
            )}
            {[
              { l: "N", d: 0 },
              { l: "O", d: 90 },
              { l: "Z", d: 180 },
              { l: "W", d: 270 },
            ].map(({ l, d }) => (
              <div
                key={l}
                className="absolute w-full h-full flex justify-center pointer-events-none"
                style={{ transform: `rotate(${d}deg)` }}
              >
                <span className="text-[8px] font-black text-blue-500/60 mt-8">
                  {l}
                </span>
              </div>
            ))}
            <div
              className="absolute bottom-1/2 left-1/2 origin-bottom transition-transform duration-500 ease-out"
              style={{
                width: "3px",
                height: "88px",
                marginLeft: "-1.5px",
                background: "linear-gradient(to top,#ef4444,#fca5a5)",
                borderRadius: "3px 3px 0 0",
                transform: `rotate(${angle}deg)`,
                boxShadow: "0 0 12px rgba(239,68,68,.7)",
              }}
            />
            <div className="w-4 h-4 bg-white rounded-full z-10 shadow-[0_0_10px_rgba(255,255,255,.5)] border-2 border-blue-400" />
          </div>

          {/* Afstand */}
          <div className="text-center font-black font-mono text-white leading-none">
            <span className="text-7xl">
              {distM < 1000 ? distM : (distM / 1000).toFixed(1)}
            </span>
            <span className="text-2xl text-white/40 ml-2">
              {distM < 1000 ? "M" : "KM"}
            </span>
          </div>

          {/* Klokrichting */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-900/60 border border-blue-700/50 flex flex-col items-center justify-center shadow-inner">
              <span className="text-3xl font-black text-white leading-none">
                {clk}
              </span>
              <span className="text-[7px] font-black text-blue-400/70 uppercase tracking-wider">
                uur
              </span>
            </div>
            <div className="text-white/60 text-sm font-bold">positie</div>
          </div>

          {/* POI naam */}
          <div className="w-full bg-blue-950/60 border border-blue-800/50 rounded-2xl px-5 py-3 text-center">
            <p className="text-yellow-400 font-black italic uppercase tracking-tight text-lg truncate">
              {activePoi.name}
            </p>
            <p className="text-blue-400/60 text-[9px] font-mono mt-0.5">
              {activePoi.pluscode}
            </p>

            {/* Wiki beschikbaar tekst */}
            {wikiInfo && !wikiPaneel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setWikiPaneel(true);
                }}
                className="mt-2 text-white text-[11px] font-black uppercase tracking-widest animate-pulse"
              >
                Wiki-informatie nu beschikbaar
              </button>
            )}
          </div>

          <p className="text-white/15 text-[8px] font-black uppercase tracking-[.5em]">
            1× TIKKEN = BEL · 3× SNEL TIKKEN = SLUITEN
          </p>
        </div>
      )}

      {/* ── Wikipedia paneel ── */}
      {wikiPaneel && wikiInfo && (
        <div
          className="absolute inset-0 flex items-end justify-center pb-8 px-4"
          style={{ zIndex: Z.eco + 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm bg-[#0a1628] border border-blue-700/40 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <p className="text-blue-300 font-black text-sm uppercase tracking-wider">
                {wikiInfo.titel}
              </p>
              <button
                onClick={() => setWikiPaneel(false)}
                className="text-white/40 text-lg font-black leading-none ml-3 flex-shrink-0"
              >
                ✕
              </button>
            </div>
            {wikiInfo.extract && (
              <p className="text-white/80 text-[12px] leading-relaxed mb-4">
                {wikiInfo.extract}
                {wikiInfo.extract.length >= 350 ? "…" : ""}
              </p>
            )}
            <a
              href={wikiInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block w-full py-3 bg-blue-700 text-white text-center text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-[0_4px_0_#0f3460] active:shadow-none active:translate-y-1 transition-all"
            >
              Lees meer op Wikipedia →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default EcoScreen;
