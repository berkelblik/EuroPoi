import { Footprints, Bike, Zap } from "lucide-react";

export const CFG = {
  version: "v1.0.0",
  appName: "EuroPoi",
  changelog: [
    {
      v: "v1.0.0",
      items: [
        "Refactor: index.jsx opgesplitst in useLocation, useGpx, useTrigger, useAudio hooks",
        "Route-POI trigger: radius automatisch groot genoeg om route altijd te raken (loodlijn principe)",
        "Audio wachtrij: wacht-melding wordt nu daadwerkelijk uitgesproken bij overlappende triggers",
        "Kaart: cirkelradius beveiligd tegen Infinity bij dunne GPX bestanden",
      ],
    },
    { v: "v6.2.0", items: ["Codebase opgesplitst in afzonderlijke modules"] },
    {
      v: "v6.1.1",
      items: [
        "Volledige vertalingen: Duits, Frans, Spaans, Italiaans",
        "Alle 6 talen volledig uitgewerkt",
      ],
    },
    {
      v: "v6.1.0",
      items: [
        "ElevenLabs foutmeldingen in systeemlog",
        "ElevenLabs testknop",
        "ElevenLabs statusbadge",
      ],
    },
    { v: "v6.0.9", items: ["Vergrendelfunctie volledig verwijderd"] },
    {
      v: "v6.0.8",
      items: [
        "EuroPoi-logo in splash en info-scherm",
        "Gebruikers-ID kopieerbaar",
        "Categorie-filter hersteld",
        "GPX-waarschuwing bij track vs. route",
        "Prikpunt knop hersteld",
        "Changelog in info-scherm",
      ],
    },
    {
      v: "v6.0.7",
      items: ["Pastel 3D knoppen werkbalk", "EuroPoi-logo in header"],
    },
    {
      v: "v6.0.6",
      items: [
        "CSV komma-decimaal fix (NL notatie)",
        "Robuuste CSV-parser voor quoted velden",
      ],
    },
    {
      v: "v6.0.5",
      items: ["Audio engine: strikte hiërarchie, geen doorval naar TTS"],
    },
    {
      v: "v6.0.4",
      items: [
        "Spraakhiërarchie 5 niveaus",
        "Bulk audio koppeling via pluscode",
      ],
    },
    {
      v: "v6.0.3",
      items: ["Fullscreen API bij eco-modus", "Eco kompas", "Wake lock"],
    },
    {
      v: "v6.0.0",
      items: [
        "Volledige rebuild: React, IndexedDB, Leaflet, SpeechSynthesis, ElevenLabs, GPX, Track",
      ],
    },
  ],
  db: { name: "EuroPoi_v6", version: 1, store: "pois" },
  cooldownMs: 10 * 60 * 1000,
  defaultCoords: { lat: 52.9735, lng: 4.6806, heading: 0 },
  trackMinDist: 8,
  trackPauseMs: 3000,
};

export const TRANSPORT = {
  Wandelaar: { radius: 30, Icon: Footprints },
  Fietser: { radius: 100, Icon: Bike },
  Motorrijder: { radius: 160, Icon: Zap },
};

export const MAP_TILES = {
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  sat: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

export const CATEGORIES = [
  "Horeca",
  "Geschiedenis",
  "Toeristisch",
  "Cultureel",
  "Natuur",
  "Knooppunten",
  "Overig",
];

export const LANGS = [
  { id: "nl-NL", label: "Nederlands" },
  { id: "en-GB", label: "English" },
  { id: "de-DE", label: "Deutsch" },
  { id: "fr-FR", label: "Français" },
  { id: "es-ES", label: "Español" },
  { id: "it-IT", label: "Italiano" },
];

// Z-index systeem — alles op één plek zodat overlapping nooit verrassend is
export const Z = {
  map: 1,
  mapUI: 10,
  coords: 20,
  toolbar: 30,
  actionbar: 35,
  poilist: 40,
  speech: 80,
  navpad: 100,
  eco: 200,
  sheet: 500,
  confirm: 600,
};
