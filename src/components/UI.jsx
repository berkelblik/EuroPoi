import { X, AlertTriangle, Music, Timer, Edit3, Trash2 } from "lucide-react";
import { Z } from "../config";

// ─── SHEET (bottom drawer) ─────────────────────────────────────────────────
export const Sheet = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 flex items-end justify-center bg-black/75 backdrop-blur-sm"
      style={{ zIndex: Z.sheet }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-[2rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border-t bg-[#0f0f0f] text-white border-white/10"
        style={{ overscrollBehavior: "none" }}
      >
        {/* Sleep-hendel */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-pointer shrink-0"
          onClick={onClose}
        >
          <div className="w-10 h-1 bg-white/20 rounded-full pp-hover-drag transition-colors" />
        </div>
        {/* Titel balk */}
        <div className="px-5 pb-3 flex items-center justify-between border-b border-white/10 shrink-0">
          <h2 className="font-black italic tracking-tighter text-blue-400 uppercase text-base">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600 text-white pp-hoverable shadow-[0_3px_0_#7f1d1d] active:shadow-none active:translate-y-1 transition-all"
          >
            <X size={18} />
          </button>
        </div>
        {/* Inhoud */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ overscrollBehavior: "contain" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── CONFIRM DIALOOG ───────────────────────────────────────────────────────
export const Confirm = ({ open, onClose, title, msg, onOk, t }) => {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
      style={{ zIndex: Z.confirm }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-xs rounded-[2rem] p-6 text-center shadow-2xl">
        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36} />
        <h3 className="text-white font-black italic uppercase text-base mb-1">
          {title}
        </h3>
        <p className="text-white/85 text-xs font-semibold mb-5">{msg}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              onOk();
              onClose();
            }}
            className="w-full py-3 bg-red-600 text-white font-black uppercase rounded-xl shadow-[0_4px_0_rgba(0,0,0,.5)] active:shadow-none active:translate-y-1 transition-all text-sm"
          >
            {t.confirm}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/8 text-white/80 font-black uppercase rounded-xl text-sm"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── FORM PRIMITIEVEN ──────────────────────────────────────────────────────
export const Field = ({ label, children }) => (
  <div>
    <label className="block text-[9px] font-black uppercase text-blue-400 mb-1 tracking-wider">
      {label}
    </label>
    {children}
  </div>
);

export const Inp = ({ className = "", ...p }) => (
  <input
    className={`w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-colors ${className}`}
    {...p}
  />
);

export const Txta = ({ className = "", ...p }) => (
  <textarea
    className={`w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-colors resize-none ${className}`}
    {...p}
  />
);

export const PushBtn = ({ children, cls = "", ...p }) => (
  <button
    className={`flex items-center justify-center gap-2 font-black uppercase rounded-2xl border-b-4 shadow active:border-b-0 active:translate-y-1 transition-all ${cls}`}
    {...p}
  >
    {children}
  </button>
);

// ─── AUDIO BRON BADGE — kleuren komen overeen met hiërarchie in Instellingen ──
export const AudioSourceBadge = ({ poi, elevenCfg, t }) => {
  const hasUrl = !!poi.audioUrl;
  const hasBulk = !!(poi.audioBulk || poi.audioBulk === true);
  const hasData = !!(poi.audioData || poi.audioData === true);
  const hasEleven = !!(elevenCfg?.apiKey?.trim().length > 10 && elevenCfg?.voiceId?.trim());

  if (hasUrl)
    return (
      <span className="text-[9px] font-black uppercase bg-blue-900/60 text-blue-300 border border-blue-700/40 px-1.5 py-0.5 rounded-full">
        {t.audioSrc1}
      </span>
    );
  if (hasBulk)
    return (
      <span className="text-[9px] font-black uppercase bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded-full">
        {t.audioSrc2}
      </span>
    );
  if (hasData)
    return (
      <span className="text-[9px] font-black uppercase bg-amber-900/60 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
        {t.audioSrc3}
      </span>
    );
  // 4. ElevenLabs — tonen als er géén audiobestand is maar wel een geldige API-key
  if (hasEleven)
    return (
      <span className="text-[9px] font-black bg-[#111] text-[#f5a623] border border-[#f5a623]/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
        <span className="text-[8px] font-black tracking-tighter">II</span>
        ElevenLabs
      </span>
    );
  // 5. Telefoon TTS als enige fallback
  return (
    <span className="text-[9px] font-black uppercase bg-slate-800/60 text-slate-400 border border-slate-600/40 px-1.5 py-0.5 rounded-full">
      {t.audioSrc5}
    </span>
  );
};

// ─── POI KAART ─────────────────────────────────────────────────────────────
export const PoiCard = ({
  poi,
  onEdit,
  onDelete,
  onSpeak,
  cooldown,
  highlight,
  cardRef,
  elevenCfg,
  t,
}) => {
  const km = Math.floor((poi.dist || 0) / 1000);
  const m = Math.round((poi.dist || 0) % 1000);
  const hasAudio = !!(poi.audioUrl || poi.audioBulk || poi.audioData);

  return (
    <div
      ref={cardRef}
      onClick={() => onSpeak(poi)}
      className={`mx-2 my-1 p-3.5 rounded-[1.25rem] flex items-center gap-3 border cursor-pointer transition-all duration-300 active:scale-[.98]
        ${
          highlight
            ? "bg-yellow-400 border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,.6)]"
            : cooldown
            ? "bg-slate-800/80 border-slate-700/60 opacity-70"
            : "bg-[#0d1b3e] border-[#1e3a6e] pp-hover-poi"
        }`}
    >
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Naam + iconen */}
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span
            className={`font-black italic uppercase tracking-tight text-sm truncate
            ${
              highlight
                ? "text-yellow-900"
                : cooldown
                ? "text-slate-500"
                : "text-yellow-400"
            }`}
          >
            {poi.name}
          </span>
          {hasAudio && (
            <Music
              size={10}
              className={`shrink-0 animate-pulse ${
                highlight ? "text-yellow-800" : "text-emerald-400"
              }`}
            />
          )}
          {cooldown && !highlight && (
            <Timer size={10} className="text-orange-400 shrink-0" />
          )}
        </div>
        {/* Pluscode + categorie + audio badge */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span
            className={`font-mono text-[10px] px-1.5 py-px rounded shrink-0 border
            ${
              highlight
                ? "text-yellow-800 bg-yellow-300/50 border-yellow-600/40"
                : "text-blue-400 bg-blue-950/60 border-blue-900/50"
            }`}
          >
            {poi.pluscode}
          </span>
          <span
            className={`text-[10px] font-black uppercase tracking-widest truncate
            ${highlight ? "text-yellow-800" : "text-blue-500/70"}`}
          >
            {poi.categories?.[0] || "—"}
          </span>
          {!highlight && (
            <AudioSourceBadge poi={poi} elevenCfg={elevenCfg} t={t} />
          )}
        </div>
        {/* Afstand */}
        <div
          className={`flex items-baseline gap-0.5 font-black leading-none ${
            highlight ? "text-yellow-900" : "text-white"
          }`}
        >
          <span className="text-lg">{km}</span>
          <span className="text-[10px] opacity-50 mr-0.5">KM</span>
          <span className="text-xs">
            {m} {t.meter}
          </span>
        </div>
      </div>
      {/* Actie knoppen */}
      <div
        className="flex flex-col gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(poi)}
          className={`w-11 h-8 rounded-lg text-white border-b-[3px] flex items-center justify-center active:border-b-0 active:translate-y-0.5 transition-all
            ${
              highlight
                ? "bg-yellow-600 border-yellow-800"
                : "bg-blue-600 border-blue-900"
            }`}
        >
          <Edit3 size={13} />
        </button>
        <button
          onClick={() => onDelete(poi.id)}
          className="w-11 h-8 rounded-lg bg-red-600/90 text-white border-b-[3px] border-red-900 flex items-center justify-center active:border-b-0 active:translate-y-0.5 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
