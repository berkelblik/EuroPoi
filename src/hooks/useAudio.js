// EuroPoi — src/hooks/useAudio.js
import { useCallback, useEffect } from "react";
import Audio$ from "../audioEngine";

export function useAudio({
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
}) {
  // Pre-warm ElevenLabs verbinding zodra API-key beschikbaar is
  useEffect(() => {
    if (elevenCfg?.apiKey?.trim().length > 10) {
      Audio$.prewarmElevenLabs(elevenCfg.apiKey);
    }
  }, [elevenCfg?.apiKey]);

  const speakPoi = useCallback(
    (p) => {
      const raw = poiDataRef.current[p.id] || {};
      const tekst = p.desc?.trim() || p.name;
      Audio$.play(tekst, {
        audioUrl: p.audioUrl,
        audioBulk: raw.audioBulk,
        audioData: raw.audioData,
        elevenCfg,
        lang,
        mode: audioMode,
        poiName: p.name,
      });
      const wasCrosshair = crosshairActive;
      setHighlightId(p.id);
      setCrosshairActive(false);
      setFollow(false);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        setHighlightId(null);
        setCrosshairActive(wasCrosshair);
        setFollow(!wasCrosshair);
      }, 10000);
      addLog(
        `Spreek: ${
          p.name
        } | Audio$.play type=${typeof Audio$.play} | tekst="${tekst.slice(
          0,
          20
        )}"`
      );
      addLog(`Audio$keys: ${Object.keys(Audio$).join(",")}`);
    },
    [
      elevenCfg,
      lang,
      audioMode,
      addLog,
      crosshairActive,
      setFollow,
      setCrosshairActive,
      setHighlightId,
      highlightTimer,
      poiDataRef,
    ]
  );
  return { speakPoi };
}
