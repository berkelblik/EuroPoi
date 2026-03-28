import {
  Copy,
  Music,
  FileAudio,
  Upload,
  Terminal,
  Trash2,
  Volume2,
} from "lucide-react";
import { Sheet, Inp, PushBtn } from "../UI";
import { TRANSPORT, LANGS } from "../../config";

const SettingsSheet = ({
  open,
  onClose,
  t,
  userId,
  adminMode,
  transport,
  setTransport,
  lang,
  setLang,
  elevenCfg,
  setElevenCfg,
  bulkStatus,
  onBulkClick,
  logs,
  setLogs,
  addLog,
}) => {
  const elevenReady =
    elevenCfg?.apiKey?.trim().length > 10 && elevenCfg?.voiceId?.trim();

  const copyUserId = () => {
    navigator.clipboard
      ?.writeText(userId)
      .then(() => {
        addLog("Gebruikers-ID gekopieerd");
      })
      .catch(() => {
        const ta = Object.assign(document.createElement("textarea"), {
          value: userId,
        });
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        addLog("Gebruikers-ID gekopieerd");
      });
  };

  const copyLogs = () => {
    const ta = Object.assign(document.createElement("textarea"), {
      value: logs.join("\n"),
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    addLog("Logs gekopieerd");
  };

  const testElevenLabs = async () => {
    addLog("ElevenLabs: test gestart...");
    try {
      const resp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenCfg.voiceId.trim()}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenCfg.apiKey.trim(),
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: "Dit is een ElevenLabs test.",
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );
      if (resp.ok) {
        const blob = await resp.blob();
        addLog(
          `ElevenLabs: OK \u2014 ${blob.size} bytes. Audio wordt afgespeeld.`
        );
        new window.Audio(URL.createObjectURL(blob))
          .play()
          .catch((e) => addLog(`Afspelen mislukt: ${e.message}`));
      } else {
        const err = await resp.text().catch(() => "");
        addLog(`ElevenLabs: HTTP ${resp.status} \u2014 ${err.slice(0, 150)}`);
      }
    } catch (e) {
      addLog(`ElevenLabs: fout \u2014 ${e.message}`);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.settings}>
      <div className="space-y-4 pb-4">
        {/* Gebruikers ID */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-2">
          <p className="text-[9px] font-black uppercase text-blue-400">
            {t.userId}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/8 px-3 py-2 rounded-xl text-blue-300 font-mono text-xs select-all">
              {userId}
            </code>
            {adminMode && (
              <span className="text-[10px] text-amber-400 font-black uppercase bg-amber-400/10 border border-amber-400/30 px-2 py-1 rounded-lg">
                ADMIN
              </span>
            )}
            <button
              onClick={copyUserId}
              className="w-9 h-9 shrink-0 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-[0_3px_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all"
            >
              <Copy size={14} />
            </button>
          </div>
          <p className="text-[9px] text-white/55">
            Tik op het kopieer-icoon om het ID naar het klembord te sturen
          </p>
        </div>

        {/* Spraakhiërarchie */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-2">
          <p className="text-[9px] font-black uppercase text-blue-400 flex items-center gap-1.5">
            <Music size={11} />
            {t.audioHierarchy}
          </p>
          {[
            t.audioSrc1,
            t.audioSrc2,
            t.audioSrc3,
            t.audioSrc4,
            t.audioSrc5,
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[9px]">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0
                ${
                  i === 0
                    ? "bg-blue-600 text-white"
                    : i === 1
                    ? "bg-emerald-700 text-white"
                    : i === 2
                    ? "bg-amber-600 text-black"
                    : i === 3
                    ? "bg-purple-700 text-white"
                    : "bg-white/10 text-white/85"
                }`}
              >
                {i + 1}
              </span>
              <span className="text-white/70">{s}</span>
            </div>
          ))}
        </div>

        {/* Bulk Audio */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
            <FileAudio size={11} />
            {t.bulkTitle}
          </p>
          <p className="text-[10px] text-white/80 leading-relaxed">
            {t.bulkHint}
          </p>
          <p className="text-[9px] text-amber-400/70">{t.bulkOverwrite}</p>
          <PushBtn
            cls="w-full py-3 bg-emerald-700 text-white border-emerald-900 text-sm"
            onClick={onBulkClick}
          >
            <Upload size={16} /> {t.bulkBtn}
          </PushBtn>
          {bulkStatus && (
            <div className="bg-black/30 rounded-xl p-3 border border-white/8 space-y-1">
              <p
                className={`text-[9px] font-black ${
                  bulkStatus.count > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {bulkStatus.count > 0
                  ? t.bulkResult(bulkStatus.count)
                  : "Geen overeenkomsten gevonden"}
              </p>
              {bulkStatus.names.map((n, i) => (
                <p
                  key={i}
                  className="text-[10px] text-white/80 font-mono truncate"
                >
                  &middot; {n}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Vervoer */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-amber-400">
            {t.transport_label}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TRANSPORT).map(([m, cfg]) => (
              <button
                key={m}
                onClick={() => setTransport(m)}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 transition-all
                  ${
                    transport === m
                      ? "bg-blue-600 border-white"
                      : "bg-black/30 border-transparent text-white/80"
                  }`}
              >
                <cfg.Icon size={18} />
                <span className="text-[10px] font-black uppercase leading-tight text-center">
                  {m}
                  <br />
                  <span className="opacity-50">({cfg.radius}m)</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Talen */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-blue-400 text-center">
            {t.languages}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                className={`py-2.5 rounded-xl text-[9px] font-black uppercase shadow-[0_3px_0_black] active:shadow-none active:translate-y-1 transition-all
                  ${
                    lang === l.id
                      ? "bg-amber-400 text-black"
                      : "bg-white/5 text-white/80"
                  }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* ElevenLabs */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase text-amber-400">
              {t.eleven}
            </p>
            {elevenReady ? (
              <span className="text-[9px] font-black uppercase bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                Ingesteld
              </span>
            ) : (
              <span className="text-[9px] font-black uppercase bg-white/5 text-white/65 border border-white/10 px-2 py-0.5 rounded-full">
                Niet ingesteld
              </span>
            )}
          </div>
          {[
            {
              k: "apiKey",
              type: "password",
              ph: "API Sleutel\u2026",
              label: "API Sleutel",
            },
            {
              k: "voiceId",
              type: "text",
              ph: "Voice ID\u2026",
              label: "Stem ID",
            },
          ].map(({ k, type, ph, label }) => (
            <div key={k}>
              <p className="text-[9px] font-black uppercase text-white/55 mb-1">
                {label}
              </p>
              <Inp
                type={type}
                placeholder={ph}
                value={elevenCfg[k] || ""}
                onChange={(e) => {
                  const n = { ...elevenCfg, [k]: e.target.value };
                  setElevenCfg(n);
                  localStorage.setItem("pp_el", JSON.stringify(n));
                }}
              />
            </div>
          ))}
          {elevenReady && (
            <PushBtn
              cls="w-full py-2.5 bg-amber-500 text-black border-amber-700 text-[10px]"
              onClick={testElevenLabs}
            >
              <Volume2 size={14} /> Test ElevenLabs
            </PushBtn>
          )}
          <p className="text-[9px] text-white/55 leading-relaxed">
            Als de test mislukt met een CORS-fout, blokkeert CodeSandbox externe
            API-aanroepen. Gebruik de gedeployde versie van de app.
          </p>
        </div>

        {/* Systeem logs */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-blue-400 flex items-center gap-1.5">
            <Terminal size={11} /> {t.sysInfo}
          </p>
          <div className="bg-black/50 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] text-emerald-400 border border-white/5">
            {logs.map((l, i) => {
              const s = String(l || "");
              const safe =
                s.includes("base64") || s.length > 150
                  ? s.slice(0, 100) + "… [ingekort]"
                  : s;
              return (
                <div key={i} className="mb-0.5">
                  {safe}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <PushBtn
              cls="flex-1 py-2 bg-blue-700 text-white border-blue-900 text-[10px]"
              onClick={copyLogs}
            >
              <Copy size={11} />
              {t.copyLogs}
            </PushBtn>
            <PushBtn
              cls="flex-1 py-2 bg-red-600 text-white border-red-900 text-[10px]"
              onClick={() => setLogs([])}
            >
              <Trash2 size={11} />
              {t.clearLogs}
            </PushBtn>
          </div>
        </div>
      </div>
    </Sheet>
  );
};

export default SettingsSheet;
