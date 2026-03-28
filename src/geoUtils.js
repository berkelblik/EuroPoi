// ─── ALGEMENE HELPERS ──────────────────────────────────────────────────────
export const isNum = (n) => typeof n === "number" && isFinite(n) && !isNaN(n);
export const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export const pinFrom = (id) => {
  if (!id) return "0000";
  const s = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (s % 10000).toString().padStart(4, "0");
};

// ─── OPEN LOCATION CODE (PLUSCODE) ────────────────────────────────────────
const A26 = "23456789CFGHJMPQRVWX";

export const encPlus = (lat, lng) => {
  if (!isNum(lat) || !isNum(lng)) return "";
  let la = Math.min(Math.max(lat, -90), 89.999999) + 90;
  let lo = Math.min(Math.max(lng, -180), 179.999999) + 180;
  let c = "";
  for (let i = 0; i < 5; i++) {
    const p = 20 ** (1 - i);
    c += A26[Math.floor(la / p)] + A26[Math.floor(lo / p)];
    la %= p;
    lo %= p;
    if (i === 3) c += "+";
  }
  return c;
};

export const decPlus = (code) => {
  if (!code) return null;
  const cl = code.replace("+", "").trim().toUpperCase();
  if (cl.length < 10) return null;
  let la = 0,
    lo = 0;
  for (let i = 0; i < 5; i++) {
    const d1 = A26.indexOf(cl[i * 2]),
      d2 = A26.indexOf(cl[i * 2 + 1]);
    if (d1 < 0 || d2 < 0) return null;
    const p = 20 ** (1 - i);
    la += d1 * p;
    lo += d2 * p;
  }
  return {
    lat: parseFloat((la - 90).toFixed(6)),
    lng: parseFloat((lo - 180).toFixed(6)),
  };
};

// ─── AFSTAND & RICHTING ────────────────────────────────────────────────────
export const hav = (la1, lo1, la2, lo2) => {
  if (!isNum(la1) || !isNum(la2)) return 0;
  const R = 6371e3,
    r = (x) => (x * Math.PI) / 180;
  const a =
    Math.sin(r(la2 - la1) / 2) ** 2 +
    Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const bear = (la1, lo1, la2, lo2) => {
  const r = (x) => (x * Math.PI) / 180,
    d = (x) => (x * 180) / Math.PI;
  const y = Math.sin(r(lo2 - lo1)) * Math.cos(r(la2));
  const x =
    Math.cos(r(la1)) * Math.sin(r(la2)) -
    Math.sin(r(la1)) * Math.cos(r(la2)) * Math.cos(r(lo2 - lo1));
  return (d(Math.atan2(y, x)) + 360) % 360;
};

export const clockDir = (h, b) => {
  const r = Math.round(((b - h + 360) % 360) / 30);
  return r === 0 ? 12 : r;
};

export const relAng = (loc, poi) => {
  if (!loc || !poi) return 0;
  return (
    (bear(loc.lat, loc.lng, poi.lat, poi.lng) - (loc.heading || 0) + 360) % 360
  );
};

// ─── ROUTE-GEBASEERDE TRIGGER ─────────────────────────────────────────────
// Berekent de kortste afstand van een punt (lat,lng) tot een polyline (array van [lat,lng])
// Geeft ook het dichtstbijzijnde punt op de lijn terug
export const distToPolyline = (lat, lng, polyline) => {
  if (!polyline || polyline.length < 2) return { dist: Infinity, pt: null };
  let best = Infinity,
    bestPt = null;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [la1, lo1] = polyline[i];
    const [la2, lo2] = polyline[i + 1];
    // Projecteer punt op segment via parametrische formule (benaderd in graden)
    const dx = lo2 - lo1,
      dy = la2 - la1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((lng - lo1) * dx + (lat - la1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const pLat = la1 + t * dy;
    const pLng = lo1 + t * dx;
    const d = hav(lat, lng, pLat, pLng);
    if (d < best) {
      best = d;
      bestPt = [pLat, pLng];
    }
  }
  return { dist: best, pt: bestPt };
};

export const fixDrop = (url) => {
  if (!url) return "";
  let u = url.trim().replace(/['"]/g, "");
  if (u.includes("dropbox.com")) {
    u = u
      .replace("www.dropbox.com", "dl.dropboxusercontent.com")
      .replace("dropbox.com", "dl.dropboxusercontent.com");
    // Verwijder tijdelijke sessie-token (st=) en dl=0 — deze verlopen
    try {
      const obj = new URL(u);
      obj.searchParams.delete("dl");
      obj.searchParams.delete("st");
      u = obj.toString();
    } catch (_) {
      u = u.replace(/[?&]st=[^&]*/g, "").replace(/[?&]dl=0/g, "");
    }
  }
  return u;
};

export const normPlus = (s) =>
  (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ─── CSV HELPERS ───────────────────────────────────────────────────────────
// Ondersteunt zowel punt als NL komma-decimaal (v6.0.6)
export const parseCoord = (s) => {
  if (!s) return NaN;
  const clean = s.trim().replace(/^"+|"+$/g, "");
  const v = parseFloat(clean);
  if (!isNaN(v)) return v;
  return parseFloat(clean.replace(",", "."));
};

// Robuuste parser — respecteert quoted velden met komma's erin (v6.0.6)
export const parseCSVLine = (line) => {
  const cols = [];
  let cur = "",
    inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if ((ch === "," || ch === ";") && !inQ) {
      cols.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
};
