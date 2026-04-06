import {
  Upload,
  Trash2,
  Save,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Sheet, PushBtn } from "../UI";
import { Z } from "../../config";

const RouteSheet = ({
  open,
  onClose,
  t,
  route,
  setRoute,
  routeName,
  setRouteName,
  track,
  setTrack,
  recOn,
  setRecOn,
  recPause,
  lastPos,
  gpxWarn,
  setGpxWarn,
  acceptGpxTrack,
  onGpxClick,
  saveTrack,
  addLog,
  // GPX route export — nieuw
  exportGpxRoute,
  selCats,
  loc,
  mapCenter,
  crosshairActive,
}) => (
  <>
    <Sheet open={open} onClose={onClose} title={t.routeMenu}>
      <div className="space-y-4 pb-4">

        {/* ── Route (rte) ── */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase text-blue-400">
              Route (GPX &mdash; &lt;rte&gt;)
            </p>
            {route.length > 0 && (
              <span className="text-[10px] text-emerald-400 font-mono">
                &bull; GELADEN ({route.length} waypoints)
              </span>
            )}
          </div>

          {routeName && route.length > 0 && (
            <div className="bg-blue-950/60 border border-blue-700/40 rounded-xl px-3 py-2">
              <p className="text-[8px] font-black uppercase text-blue-400/70 mb-0.5">
                Routenaam
              </p>
              <p className="text-white font-black text-[13px] italic">
                {routeName}
              </p>
              <p className="text-blue-300/60 text-[8px] mt-1">
                POI&apos;s met categorie{" "}
                <span className="text-yellow-400 font-black">
                  &ldquo;{routeName}&rdquo;
                </span>{" "}
                worden getriggerd op dichtstbijzijnde routepunt
              </p>
            </div>
          )}

          <p className="text-[10px] text-white/70 leading-relaxed">
            Laad een{" "}
            <span className="text-white/90 font-black">
              GPX-routebestand (&lt;rte&gt;)
            </span>{" "}
            voor navigatie. Een routebestand bevat geplande waypoints als{" "}
            <span className="text-blue-300 font-mono text-[9px]">
              &lt;rtept&gt;
            </span>{" "}
            elementen — het formaat dat routeplanners zoals Komoot en OsmAnd
            gebruiken. Opgenomen tracks (
            <span className="text-amber-300 font-mono text-[9px]">
              &lt;trkpt&gt;
            </span>
            ) worden apart gemeld.
          </p>

          <div className="flex gap-2">
            <PushBtn
              cls="flex-1 py-3 bg-blue-700 text-white border-blue-900 text-[10px]"
              onClick={onGpxClick}
            >
              <Upload size={15} />
              {t.loadGpx}
            </PushBtn>
            {route.length > 0 && (
              <button
                onClick={() => {
                  setRoute([]);
                  setRouteName?.("");
                  addLog("Route gewist");
                }}
                className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 transition-all"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── GPX Route exporteren (nieuw) ── */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-teal-400">
            Route exporteren voor Komoot / OsmAnd
          </p>

          <p className="text-[10px] text-white/70 leading-relaxed">
            Exporteer alle POI&apos;s van de{" "}
            <span className="text-white/90 font-black">actief geselecteerde categorie</span>{" "}
            als GPX-routebestand (
            <span className="text-teal-300 font-mono text-[9px]">&lt;rtept&gt;</span>
            ). De volgorde wordt bepaald via het dichtstbijzijnde-buur
            algoritme. Startpunt: crosshair-positie &rarr; GPS-locatie &rarr;
            meest noordwestelijke POI.
          </p>

          {selCats && selCats.length > 0 ? (
            <div className="bg-teal-950/40 border border-teal-700/30 rounded-xl px-3 py-2">
              <p className="text-[8px] font-black uppercase text-teal-400/70 mb-0.5">
                Actieve categorie
              </p>
              <p className="text-white font-black text-[13px] italic">
                {selCats[0]}
              </p>
              {selCats.length > 1 && (
                <p className="text-teal-300/50 text-[8px] mt-0.5">
                  Alleen de eerste categorie wordt gebruikt voor de export
                </p>
              )}
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-700/30 rounded-xl px-3 py-2">
              <p className="text-[9px] text-amber-300/80">
                Selecteer eerst een categorie via het filter in de hoofdweergave
                om een GPX-route te kunnen exporteren.
              </p>
            </div>
          )}

          <PushBtn
            cls={`w-full py-3 text-[10px] ${
              selCats && selCats.length
                ? "bg-teal-700 text-white border-teal-900"
                : "bg-white/10 text-white/30 border-white/10"
            }`}
            onClick={() => {
              if (!selCats || !selCats.length) return;
              exportGpxRoute({ selCats, loc, mapCenter, crosshairActive });
            }}
          >
            <Download size={15} />
            Exporteer GPX-route
          </PushBtn>
        </div>

        {/* ── Track opname ── */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase text-amber-400">
              Track Opname (&lt;trk&gt;)
            </p>
            <span
              className={`text-[10px] font-mono ${
                recOn
                  ? recPause
                    ? "text-amber-300 animate-pulse"
                    : "text-red-400 animate-pulse"
                  : "text-white/65"
              }`}
            >
              {recOn ? (recPause ? t.trackPause : t.trackOn) : t.trackOff}
            </span>
          </div>

          <p className="text-[10px] text-white/70 leading-relaxed">
            Neem je eigen GPS-pad op als{" "}
            <span className="text-amber-300 font-mono text-[9px]">
              &lt;trkpt&gt;
            </span>{" "}
            track. Een track is een opgenomen rijpad — geen navigatieroute.
            Opgeslagen in GPX 1.1 formaat, compatibel met Komoot, OsmAnd en
            Garmin.
          </p>

          <PushBtn
            cls={`w-full py-4 text-sm ${
              recOn
                ? "bg-amber-500 text-black border-amber-700"
                : "bg-emerald-700 text-white border-emerald-900"
            }`}
            onClick={() => {
              setRecOn((v) => !v);
              if (!recOn && lastPos) lastPos.current = null;
            }}
          >
            {recOn ? (
              <>
                <PauseCircle size={22} />
                {t.stopRec}
              </>
            ) : (
              <>
                <PlayCircle size={22} />
                {t.startRec}
              </>
            )}
          </PushBtn>

          <div className="flex gap-2">
            <PushBtn
              cls="flex-1 py-2.5 bg-blue-700/40 border-blue-700 text-blue-300 text-[9px]"
              onClick={saveTrack}
            >
              <Save size={13} />
              {t.saveTrack}
            </PushBtn>
            <PushBtn
              cls="flex-1 py-2.5 bg-red-700/30 border-red-700 text-red-400 text-[9px]"
              onClick={() => {
                setTrack([]);
                addLog("Track gewist");
              }}
            >
              <Trash2 size={13} />
              {t.clearTrack}
            </PushBtn>
          </div>
        </div>

      </div>
    </Sheet>

    {/* ── GPX track-bestand waarschuwing ── */}
    {gpxWarn && (
      <div
        className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
        style={{ zIndex: Z.confirm }}
      >
        <div className="bg-[#1a1a1a] border border-amber-500/30 w-full max-w-xs rounded-[2rem] p-6 text-center shadow-2xl">
          <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36} />
          <h3 className="text-white font-black italic uppercase text-base mb-2">
            Track-bestand gedetecteerd
          </h3>
          <p className="text-white/90 text-xs leading-relaxed mb-2">
            Het bestand{" "}
            <span className="text-amber-300 font-mono">{gpxWarn.fileName}</span>{" "}
            bevat een opgenomen{" "}
            <span className="text-amber-300 font-black">
              track (&lt;trkpt&gt;)
            </span>
            , geen planbare route.
          </p>
          <p className="text-white/80 text-[10px] leading-relaxed mb-5">
            Voor navigatie via Komoot, OsmAnd of EuroPoi zijn{" "}
            <span className="text-white font-black">
              GPX-routebestanden met &lt;rtept&gt; waypoints
            </span>{" "}
            vereist. Een track is een opgenomen rijpad en bevat geen
            navigatie-instructies. Je kunt dit bestand laden voor weergave op
            de kaart, maar gebruik het niet als navigatieroute.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={acceptGpxTrack}
              className="w-full py-3 bg-amber-500 text-black font-black uppercase rounded-xl shadow-[0_4px_0_rgba(0,0,0,.5)] active:shadow-none active:translate-y-1 transition-all text-sm"
            >
              Toch laden (alleen weergave)
            </button>
            <button
              onClick={() => setGpxWarn(null)}
              className="w-full py-3 bg-white/8 text-white/80 font-black uppercase rounded-xl text-sm"
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default RouteSheet;
