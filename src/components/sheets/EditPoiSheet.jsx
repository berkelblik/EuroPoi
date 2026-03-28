import { useState } from "react";
import {
  Save,
  RefreshCw,
  PlayCircle,
  Trash2,
  Camera,
  FolderOpen,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { Sheet, Field, Inp, Txta, PushBtn } from "../UI";
import { isNum, decPlus, encPlus, fixDrop } from "../../geoUtils";
import DB from "../../db";

const EditPoiSheet = ({
  editPoi,
  setEditPoi,
  setPois,
  availCats,
  addLog,
  onAudioBrowse,
  onPhotoBrowse,
  onSaveRaw,
  t,
}) => {
  if (!editPoi) return null;
  const [catInput, setCatInput] = useState("");

  // Combineer DB-categorieën met categorieën die al in de huidige POI zitten
  // zodat nieuw ingevoerde waarden direct terugkomen in de dropdown
  const allCats = Array.from(
    new Set([...availCats, ...(editPoi.categories || [])])
  ).sort();

  const addCat = (cat) => {
    const c = cat.trim();
    if (!c) return;
    const current = editPoi.categories || [];
    if (current.includes(c)) return;
    setEditPoi({ ...editPoi, categories: [...current, c] });
    setCatInput("");
  };

  const removeCat = (cat) => {
    setEditPoi({
      ...editPoi,
      categories: (editPoi.categories || []).filter((c) => c !== cat),
    });
  };

  const plusOk = editPoi.pluscode?.trim().length >= 10;

  const handleSave = async () => {
    if (!plusOk) {
      addLog("Fout: Pluscode is verplicht (minimaal 10 tekens)");
      return;
    }
    const coords = decPlus(editPoi.pluscode);
    const poi = coords
      ? { ...editPoi, lat: coords.lat, lng: coords.lng }
      : editPoi;
    if (!isNum(poi.lat)) {
      addLog("Fout: ongeldige pluscode, kan coördinaten niet bepalen");
      return;
    }
    // Sla volledige data (incl. base64) op in DB
    await DB.save(poi);
    // Sla base64 op in ref voor audio, maar geef render state schone versie
    onSaveRaw?.(poi.id, { audioBulk: poi.audioBulk, audioData: poi.audioData });
    const renderPoi = {
      ...poi,
      audioBulk: poi.audioBulk ? true : null,
      audioData: poi.audioData ? true : null,
    };
    setPois((prev) => {
      const i = prev.findIndex((x) => x.id === renderPoi.id);
      if (i >= 0) {
        const n = [...prev];
        n[i] = renderPoi;
        return n;
      }
      return [renderPoi, ...prev];
    });
    setEditPoi(null);
    addLog(`Opgeslagen: ${poi.name}`);
  };

  // Bij pluscode-wijziging: direct coördinaten afleiden
  const handlePlusChange = (val) => {
    const up = val.toUpperCase();
    const coords = decPlus(up);
    setEditPoi(
      coords
        ? { ...editPoi, pluscode: up, lat: coords.lat, lng: coords.lng }
        : { ...editPoi, pluscode: up }
    );
  };

  // Bij decode-knop: pluscode → coördinaten
  const handleDecode = () => {
    const coords = decPlus(editPoi.pluscode);
    if (coords) setEditPoi({ ...editPoi, lat: coords.lat, lng: coords.lng });
    else addLog("Ongeldige pluscode");
  };

  const previewAudio = () => {
    const src = editPoi.audioUrl
      ? fixDrop(editPoi.audioUrl)
      : editPoi.audioBulk || editPoi.audioData;
    if (src) new window.Audio(src).play().catch(() => {});
  };

  const clearAudio = () =>
    setEditPoi({
      ...editPoi,
      audioData: null,
      audioUrl: "",
      audioFileName: "",
    });

  return (
    <Sheet open={!!editPoi} onClose={() => setEditPoi(null)} title={t.editPoi}>
      <div className="space-y-3 pb-4">
        {/* Naam */}
        <Field label={t.name}>
          <Inp
            value={editPoi.name}
            onChange={(e) => setEditPoi({ ...editPoi, name: e.target.value })}
          />
        </Field>

        {/* Pluscode — VERPLICHT */}
        <Field label={`${t.pluscode} \u2605 verplicht`}>
          <div className="flex gap-2">
            <Inp
              value={editPoi.pluscode || ""}
              onChange={(e) => handlePlusChange(e.target.value)}
              className={`font-mono text-amber-400 ${
                !plusOk ? "border-red-500/70" : "border-emerald-500/50"
              }`}
              placeholder="bijv. 9F4857BX+G6"
            />
            <button
              onClick={handleDecode}
              className="px-3 rounded-xl bg-amber-500 text-black shadow-[0_3px_0_rgba(0,0,0,.4)] active:shadow-none active:translate-y-1 transition-all"
              title="Coördinaten afleiden uit Pluscode"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {!plusOk && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle size={10} className="text-red-400 shrink-0" />
              <span className="text-[9px] text-red-400">
                Pluscode is verplicht — minimaal 10 tekens
              </span>
            </div>
          )}
        </Field>

        {/* Lat / Lng — readonly, afgeleid van pluscode */}
        <div className="grid grid-cols-2 gap-2">
          {["lat", "lng"].map((f) => (
            <Field key={f} label={`${f.toUpperCase()} \u2014 afgeleid`}>
              <Inp
                type="text"
                value={isNum(editPoi[f]) ? editPoi[f].toFixed(6) : "—"}
                readOnly
                className="font-mono text-white/50 bg-white/3 cursor-default"
              />
            </Field>
          ))}
        </div>

        {/* Beschrijving */}
        <Field label={t.desc}>
          <Txta
            rows={3}
            value={editPoi.desc || ""}
            onChange={(e) => setEditPoi({ ...editPoi, desc: e.target.value })}
            placeholder="Toelichting voor de stem\u2026"
          />
        </Field>

        {/* Categorie */}
        <Field label={t.cat}>
          {/* Bestaande tags */}
          {(editPoi.categories || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(editPoi.categories || []).map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1 bg-blue-700/60 border border-blue-500/40 text-white text-[10px] font-black px-2 py-0.5 rounded-full"
                >
                  {c}
                  <button
                    onClick={() => removeCat(c)}
                    className="text-white/60 ml-0.5"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Dropdown bestaande categorieën */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addCat(e.target.value);
            }}
            className="w-full bg-white/5 border border-white/10 p-2 rounded-xl text-white text-[11px] outline-none mb-1"
          >
            <option value="">+ Kies bestaande categorie…</option>
            {availCats
              .filter((c) => !(editPoi.categories || []).includes(c))
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
          {/* Nieuwe categorie typen */}
          <div className="flex gap-1">
            <Inp
              placeholder="Nieuwe categorie…"
              value={catInput}
              onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCat(catInput);
                }
              }}
            />
            <button
              onClick={() => addCat(catInput)}
              className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_3px_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all shrink-0"
            >
              <Plus size={14} />
            </button>
          </div>
        </Field>

        {/* Radius */}
        <Field label={t.radius}>
          <Inp
            type="number"
            value={editPoi.radius || 0}
            onChange={(e) =>
              setEditPoi({ ...editPoi, radius: parseInt(e.target.value) || 0 })
            }
          />
        </Field>

        {/* Audio sectie */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase text-amber-400">
              {t.audio}
            </p>
            <span className="text-[9px] text-white/65 font-black uppercase bg-white/5 px-2 py-0.5 rounded-full">
              {t.audioSrc3}
            </span>
          </div>

          {/* Mini status overzicht */}
          <div className="bg-black/20 rounded-xl p-2.5 space-y-1 border border-white/5">
            {[
              {
                src: editPoi.audioUrl,
                label: t.audioSrc1,
                col: "text-blue-400",
              },
              {
                src: editPoi.audioBulk,
                label: t.audioSrc2,
                col: "text-emerald-400",
              },
              {
                src: editPoi.audioData,
                label: t.audioSrc3,
                col: "text-amber-400",
              },
            ].map(({ src, label, col }, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    src ? "bg-emerald-400" : "bg-white/15"
                  }`}
                />
                <span
                  className={`text-[9px] font-black ${
                    src ? col : "text-white/50"
                  }`}
                >
                  {label}
                </span>
                {src && (
                  <span className="text-[9px] text-white/65 font-mono truncate max-w-[140px]">
                    {src.startsWith("data:")
                      ? `(${
                          editPoi.audioFileName ||
                          editPoi.audioBulkName ||
                          "bestand"
                        })`
                      : src.slice(0, 35) + "..."}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* URL veld */}
          <Field label={`${t.audioSrc1} \u2014 URL`}>
            <Inp
              placeholder="https://www.dropbox.com/\u2026"
              value={editPoi.audioUrl || ""}
              onChange={(e) =>
                setEditPoi({ ...editPoi, audioUrl: e.target.value })
              }
            />
          </Field>

          {/* Lokaal bestand */}
          <Field label={t.browseAudio}>
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-black/30 border border-white/10 px-3 py-2.5 rounded-xl text-[10px] font-mono truncate min-w-0">
                {editPoi.audioFileName ? (
                  <span className="text-amber-400">
                    {editPoi.audioFileName}
                  </span>
                ) : (
                  <span className="text-white/55 italic">
                    Geen bestand gekozen
                  </span>
                )}
              </div>
              <button
                onClick={onAudioBrowse}
                className="shrink-0 w-11 h-10 bg-amber-500 text-black rounded-xl flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,.4)] active:shadow-none active:translate-y-1 transition-all"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </Field>

          {/* Preview / Wis knoppen */}
          {(editPoi.audioUrl || editPoi.audioBulk || editPoi.audioData) && (
            <div className="flex items-center justify-between bg-black/20 px-3 py-2 rounded-xl border border-white/8">
              <span className="text-[10px] font-black uppercase text-emerald-400">
                {editPoi.audioUrl
                  ? "\u25CF URL actief"
                  : editPoi.audioBulk
                  ? "\u25CF Bulk actief"
                  : "\u25CF Lokaal actief"}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={previewAudio}
                  className="w-8 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shadow-[0_2px_0_black] active:shadow-none active:translate-y-0.5 transition-all"
                >
                  <PlayCircle size={14} />
                </button>
                <button
                  onClick={clearAudio}
                  className="w-8 h-7 bg-red-600    rounded-lg flex items-center justify-center shadow-[0_2px_0_black] active:shadow-none active:translate-y-0.5 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Foto */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/8 space-y-3">
          <p className="text-[9px] font-black uppercase text-amber-400">
            {t.photo}
          </p>
          <div className="flex gap-3 items-center">
            <PushBtn
              cls="flex-1 py-2.5 bg-blue-700 text-white border-blue-900 text-[10px]"
              onClick={onPhotoBrowse}
            >
              <Camera size={14} />
              {t.photo}
            </PushBtn>
            {editPoi.imageData && (
              <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-blue-500 shrink-0">
                <img
                  src={editPoi.imageData}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
            )}
          </div>
        </div>

        {/* Opslaan */}
        <PushBtn
          cls="w-full py-4 bg-blue-600 text-white border-blue-900 text-sm"
          onClick={handleSave}
        >
          <Save size={16} /> {t.save}
        </PushBtn>
      </div>
    </Sheet>
  );
};

export default EditPoiSheet;
