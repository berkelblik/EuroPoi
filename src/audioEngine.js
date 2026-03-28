import { fixDrop } from "./geoUtils";

const Audio$ = (() => {
  let cur = null,
    onSpeak = null;
  const sp = (v) => onSpeak?.(v);
  let logCb = null;
  const setLog = (cb) => {
    logCb = cb;
  };
  const log = (msg) => {
    try {
      logCb?.(msg);
    } catch (_) {}
    console.warn("[Audio$]", msg);
  };

  let queue = [],
    busy = false;
  const isPlaying = () => busy;

  const processQueue = async () => {
    if (busy || queue.length === 0) return;
    busy = true;
    while (queue.length > 0) {
      const item = queue.shift();
      await _playNow(item.text, item.opts);
    }
    busy = false;
  };

  const stop = () => {
    queue = [];
    busy = false;
    if (cur) {
      try {
        cur.pause();
      } catch (_) {}
      cur = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}
    try {
      const c = window.Capacitor;
      if (c?.isNativePlatform?.() && c.Plugins?.NativeTTS)
        c.Plugins.NativeTTS.stop();
    } catch (_) {}
    sp(false);
  };

  const bell = (mode) => {
    if (mode === "silent") return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 160].forEach((d) =>
        setTimeout(() => {
          const o = ctx.createOscillator(),
            g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = "sine";
          o.frequency.setValueAtTime(1200, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
          g.gain.setValueAtTime(0.4, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          o.start();
          o.stop(ctx.currentTime + 0.5);
        }, d)
      );
    } catch (_) {}
  };

  // Native Android TTS via JavascriptInterface (window.AndroidTTS)
  const nativeTts = (text, lang) =>
    new Promise((done) => {
      // Probeer window.AndroidTTS — beschikbaar in APK via addJavascriptInterface
      const bridge = window.AndroidTTS;
      log(`AndroidTTS check: ${typeof bridge} speak=${typeof bridge?.speak}`);
      if (!bridge || typeof bridge.speak !== "function") {
        log("AndroidTTS niet beschikbaar");
        done(false);
        return;
      }
      try {
        sp(true);
        log(`AndroidTTS.speak: "${text.slice(0, 40)}"`);
        bridge.speak(text, lang || "nl-NL");
        const woorden = (text || "").split(" ").length;
        const ms = Math.max(2000, woorden * 450);
        log(`AndroidTTS wacht ${ms}ms`);
        setTimeout(() => {
          sp(false);
          done(true);
        }, ms);
      } catch (e) {
        log(`AndroidTTS fout: ${e.message}`);
        sp(false);
        done(false);
      }
    });

  const browserTts = (text, lang) =>
    new Promise((done) => {
      if (!window.speechSynthesis || !text?.trim()) {
        done();
        return;
      }
      const doSpeak = () => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || "nl-NL";
        const vs = window.speechSynthesis.getVoices();
        const v =
          vs.find((x) => x.lang.startsWith((lang || "nl-NL").slice(0, 2))) ||
          vs.find((x) => x.lang.startsWith("nl")) ||
          vs[0];
        if (v) u.voice = v;
        u.onstart = () => {
          log(`Browser TTS: "${text.slice(0, 30)}"`);
          sp(true);
        };
        u.onend = () => {
          sp(false);
          done();
        };
        u.onerror = (e) => {
          log(`Browser TTS fout: ${e.error}`);
          sp(false);
          done();
        };
        window.speechSynthesis.speak(u);
      };
      const vs = window.speechSynthesis.getVoices();
      if (vs?.length > 0) {
        doSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          doSpeak();
        };
        setTimeout(doSpeak, 1000);
      }
    });

  const tts = async (text, lang) => {
    if (!text?.trim()) return;
    const ok = await nativeTts(text, lang);
    if (!ok) await browserTts(text, lang);
  };

  const playAudioSrc = (src) =>
    new Promise((res) => {
      if (!src?.trim()) {
        res(false);
        return;
      }
      const audio = new window.Audio();
      let settled = false;
      const ok = () => {
        if (settled) return;
        settled = true;
        res(true);
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        try {
          audio.pause();
        } catch (_) {}
        cur = null;
        sp(false);
        res(false);
      };
      audio.oncanplaythrough = () => {
        cur = audio;
        sp(true);
        audio
          .play()
          .then(() => {
            audio.onended = ok;
            audio.onerror = fail;
          })
          .catch(fail);
      };
      audio.onerror = fail;
      const timeout = setTimeout(() => {
        if (!settled && audio.readyState < 3) fail();
      }, 7000);
      audio.addEventListener("ended", () => clearTimeout(timeout), {
        once: true,
      });
      audio.addEventListener("error", () => clearTimeout(timeout), {
        once: true,
      });
      audio.src = src;
      audio.load();
    });

  const announce = async (text, lang, mode) => {
    if (mode === "silent") return;
    bell(mode);
    await new Promise((r) => setTimeout(r, 1800));
    await tts(text, lang);
    await new Promise((r) => setTimeout(r, 400));
    bell(mode);
    await new Promise((r) => setTimeout(r, 1800));
  };

  // ElevenLabs: pre-warm de verbinding zodat de eerste aanvraag niet traag is
  const _prewarmElevenLabs = (() => {
    let done = false;
    return (apiKey) => {
      if (done || !apiKey?.trim()) return;
      done = true;
      fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: { "xi-api-key": apiKey.trim() },
      }).catch(() => {});
    };
  })();

  const _elevenLabsTts = async (text, elevenCfg) => {
    const online = navigator.onLine;
    if (
      !online ||
      !elevenCfg?.apiKey?.trim() ||
      elevenCfg.apiKey.trim().length <= 10 ||
      !elevenCfg?.voiceId?.trim()
    ) {
      return false;
    }
    // Pre-warm voor toekomstige aanroepen
    _prewarmElevenLabs(elevenCfg.apiKey);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenCfg.voiceId.trim()}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "xi-api-key": elevenCfg.apiKey.trim(),
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );
      clearTimeout(timeout);
      if (resp.ok) {
        const blob = await resp.blob();
        const ok = await playAudioSrc(URL.createObjectURL(blob));
        if (ok) return true;
        stop();
      } else {
        const e = await resp.text().catch(() => "");
        log(`ElevenLabs: HTTP ${resp.status} — ${e.slice(0, 120)}`);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        log("ElevenLabs: timeout (>8s), fallback naar TTS");
      } else {
        log(`ElevenLabs: fout — ${err.message}`);
      }
    }
    return false;
  };

  const _playNow = async (
    text,
    { audioUrl, audioBulk, audioData, elevenCfg, lang, mode, announceText }
  ) => {
    if (mode === "silent") return;
    if (announceText) await announce(announceText, lang, mode);
    const online = navigator.onLine;
    const realUrl =
      typeof audioUrl === "string" && audioUrl.trim() ? audioUrl : null;
    const realBulk =
      typeof audioBulk === "string" && audioBulk.trim() ? audioBulk : null;
    const realData =
      typeof audioData === "string" && audioData.trim() ? audioData : null;
    log(
      `_playNow: url=${!!realUrl} bulk=${!!realBulk} data=${!!realData} eleven=${!!elevenCfg?.apiKey} text="${(
        text || ""
      ).slice(0, 25)}"`
    );

    // 1. Opgenomen audio via URL (online)
    if (realUrl && online) {
      const ok = await playAudioSrc(fixDrop(realUrl));
      if (ok) return;
    }
    // 2. Opgenomen audio bulk (inline base64)
    if (realBulk) {
      const ok = await playAudioSrc(realBulk);
      if (ok) return;
    }
    // 3. Opgenomen audio data (inline)
    if (realData) {
      const ok = await playAudioSrc(realData);
      if (ok) return;
    }
    // 4. ElevenLabs TTS (met API-key, online)
    if (text?.trim()) {
      const ok = await _elevenLabsTts(text, elevenCfg);
      if (ok) return;
    }
    // 5. Fallback: ingebouwde TTS (native Android of browser)
    if (text?.trim()) await tts(text, lang);
  };

  const play = (text, opts) => {
    log(
      `play() aangeroepen: mode=${opts.mode} busy=${busy} text="${(
        text || ""
      ).slice(0, 30)}"`
    );
    if (opts.mode === "silent") {
      log("play() gestopt: silent mode");
      return Promise.resolve();
    }
    if (!busy) {
      busy = true;
      log("play() start _playNow");
      return _playNow(text, opts).finally(() => {
        busy = false;
        processQueue();
      });
    }
    const poiName = opts.poiName || text.slice(0, 30);
    log(`Wachtrij: "${poiName}" toegevoegd`);
    queue.push({ text, opts: { ...opts, announceText: null } });
    return Promise.resolve();
  };

  const announceAndPlay = (announceText, text, opts) => {
    if (opts.mode === "silent") return Promise.resolve();
    if (!busy) {
      busy = true;
      return announce(announceText, opts.lang, opts.mode)
        .then(() => _playNow(text, opts))
        .finally(() => {
          busy = false;
          processQueue();
        });
    }
    const poiName = opts.poiName || text.slice(0, 30);
    log(`Wachtrij (auto): "${poiName}" toegevoegd`);
    queue.push({ text, opts: { ...opts, announceText } });
    return Promise.resolve();
  };

  return {
    stop,
    announce,
    play,
    announceAndPlay,
    isPlaying,
    prewarmElevenLabs: _prewarmElevenLabs,
    onSpeak: (cb) => {
      onSpeak = cb;
    },
    setLog,
  };
})();

export default Audio$;
