import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Sheet } from "../UI";
import { CFG } from "../../config";

const AboutSheet = ({ open, onClose, t, logs }) => {
  const [copied, setCopied] = useState(false);

  const copyLogs = () => {
    const text = (logs || []).join("\n") || "(geen log-regels)";
    navigator.clipboard?.writeText(text).catch(() => {
      const ta = Object.assign(document.createElement("textarea"), {
        value: text,
      });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.aboutTitle}>
      <div className="space-y-4 pb-4">
        <div className="text-center space-y-3">
          <div className="w-28 h-28 mx-auto rounded-[2rem] overflow-hidden shadow-xl border-2 border-white/20">
            <img
              src="/EuroPoiLogo.png"
              alt="EuroPoi"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-white/90 whitespace-pre-line text-xs font-mono leading-relaxed">
            {t.aboutText}
          </p>
        </div>

        {/* Kopieerbaar logvenster */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">
              Systeem Log
            </p>
            <button
              onClick={copyLogs}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all
                ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-white/8 text-white/85 pp-hover-bright"
                }`}
            >
              {copied ? (
                <>
                  <Check size={10} /> Gekopieerd
                </>
              ) : (
                <>
                  <Copy size={10} /> Kopiëren
                </>
              )}
            </button>
          </div>
          <div className="bg-black/50 rounded-xl p-3 h-36 overflow-y-auto font-mono text-[10px] text-emerald-400 border border-white/5 space-y-px">
            {(logs || []).length === 0 ? (
              <span className="text-white/50">— nog geen log-regels —</span>
            ) : (
              (logs || []).map((l, i) => {
                const s = String(l || "");
                const safe =
                  s.includes("base64") || s.length > 150
                    ? s.slice(0, 100) + "… [ingekort]"
                    : s;
                return <div key={i}>{safe}</div>;
              })
            )}
          </div>
        </div>

        {/* Versiegeschiedenis */}
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest">
            Versiegeschiedenis
          </p>
          {CFG.changelog.map((entry, ei) => (
            <div
              key={ei}
              className={`rounded-xl p-3 border ${
                ei === 0
                  ? "bg-blue-950/60 border-blue-700/50"
                  : "bg-white/3 border-white/8"
              }`}
            >
              <p
                className={`text-[9px] font-black uppercase mb-1.5 ${
                  ei === 0 ? "text-blue-300" : "text-white/80"
                }`}
              >
                {entry.v}
              </p>
              <ul className="space-y-0.5">
                {entry.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-1.5">
                    <span
                      className={`text-[10px] mt-px shrink-0 ${
                        ei === 0 ? "text-blue-400" : "text-white/55"
                      }`}
                    >
                      &bull;
                    </span>
                    <span
                      className={`text-[10px] leading-relaxed ${
                        ei === 0 ? "text-white/80" : "text-white/70"
                      }`}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center text-[10px] opacity-20 font-mono pt-1">
          {CFG.version}
        </div>
      </div>
    </Sheet>
  );
};

export default AboutSheet;
