import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { html } from "htm/react";
import { TopBar } from "./components/TopBar.js";
import { SearchStrip } from "./components/SearchStrip.js";
import { Carousel } from "./components/carousel/Carousel.js";
import { Terminal } from "./components/terminal/Terminal.js";
import { DetailModal } from "./components/modals/DetailModal.js";
import { NewEntryModal } from "./components/modals/NewEntryModal.js";
import { MapModal } from "./components/modals/MapModal.js";
import { PurgeModal } from "./components/modals/PurgeModal.js";
import { RestoreModal } from "./components/modals/RestoreModal.js";
import { RelationshipsModal } from "./components/modals/RelationshipsModal.js";
import { loadProfiles, saveProfiles, saveAllState, normalizeProfile, extractProfilesFromBackup, CLASSIFIED_PIN_KEY } from "./lib/storage.js";
import { geocodeOSM, geocodeCached, haversineKm, getUserLocation } from "./lib/geocode.js";
import { downloadJSON } from "./lib/utils.js";
import { useImageDir } from "./hooks/useImageDir.js";
import { FIELDS } from "./constants/fields.js";
import { interpretChat } from "./lib/chat.js";

export function App() {
  const [profiles, setProfiles] = useState(loadProfiles());
  const [index, setIndex] = useState(0);
  const [openProfile, setOpenProfile] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapFocusId, setMapFocusId] = useState(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);
  const [classifiedMode, setClassifiedMode] = useState(false);
  const [classifiedPin, setClassifiedPin] = useState(() => localStorage.getItem(CLASSIFIED_PIN_KEY) || null);
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const [chatMode, setChatMode] = useState(false);
  const [chatPending, setChatPending] = useState(null);
  const [toast, setToast] = useState(null);

  const filtered = useMemo(() => {
    const visible = classifiedMode ? profiles : profiles.filter((p) => !p.classified);
    const pois = visible.filter((p) => p.poi);
    const rest = visible.filter((p) => !p.poi);
    pois.sort((a, b) => {
      const la = (a.lastName || "").toLowerCase();
      const lb = (b.lastName || "").toLowerCase();
      if (la !== lb) return la < lb ? -1 : 1;
      const fa = (a.firstName || "").toLowerCase();
      const fb = (b.firstName || "").toLowerCase();
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
    const ordered = [...pois, ...rest];
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((p) => {
      if (field === "all") {
        return [
          p.firstName, p.lastName, p.dob, p.ethnicity, p.sex,
          p.address, p.description, p.id,
          ...(p.contacts || []).map((c) => c.value),
          ...(p.relationships || []).map((r) => r.name)
        ].some((v) => String(v || "").toLowerCase().includes(q));
      }
      return String(p[field] || "").toLowerCase().includes(q);
    });
  }, [profiles, query, field, classifiedMode]);

  useEffect(() => { setIndex(0); }, [query, field]);
  useEffect(() => {
    if (index > filtered.length) setIndex(0);
  }, [filtered.length, index]);

  const { dirName, setDirName, pickDirectory, resolve, hasMap } = useImageDir();

  const [saved, setSaved] = useState(false);
  const _savedTimer = useRef(null);
  const markSaved = useCallback(() => {
    setSaved(true);
    if (_savedTimer.current) clearTimeout(_savedTimer.current);
    _savedTimer.current = setTimeout(() => { setSaved(false); _savedTimer.current = null; }, 1600);
  }, []);
  useEffect(() => () => { if (_savedTimer.current) clearTimeout(_savedTimer.current); }, []);
  const _firstSave = useRef(true);
  useEffect(() => {
    if (_firstSave.current) { _firstSave.current = false; return; }
    markSaved();
  }, [profiles, dirName, classifiedPin, markSaved]);

  useEffect(() => { saveAllState(profiles, dirName, classifiedPin); }, [profiles, dirName, classifiedPin]);

  useEffect(() => {
    const handleBeforeUnload = () => saveAllState(profiles, dirName, classifiedPin);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [profiles, dirName, classifiedPin]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1900);
  };

  const findProfileByRef = (ref) => {
    const q = (ref || "").trim().toLowerCase();
    if (!q) return { idx: null };
    if (/^\d+$/.test(q)) {
      const n = parseInt(q, 10) - 1;
      if (n >= 0 && n < profiles.length) return { idx: n, profile: profiles[n] };
    }
    let idx = profiles.findIndex((p) => (p.id || "").toLowerCase() === q);
    if (idx >= 0) return { idx, profile: profiles[idx] };
    idx = profiles.findIndex((p) => {
      const fn = (p.firstName || "").toLowerCase();
      const ln = (p.lastName || "").toLowerCase();
      const full = (fn + " " + ln).trim();
      return fn === q || ln === q || full === q || full.includes(q);
    });
    if (idx >= 0) return { idx, profile: profiles[idx] };
    return { idx: null };
  };

  const findNearestProfile = async (profileList) => {
    const userLoc = await getUserLocation();
    let best = null, bestDist = Infinity;
    for (const p of profileList) {
      if (!p.address) continue;
      let geo = geocodeCached(p.address);
      if (geo === undefined) geo = await geocodeOSM(p.address);
      if (!geo) continue;
      const dist = haversineKm(userLoc.lat, userLoc.lng, geo.lat, geo.lng);
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    return { profile: best, distKm: bestDist, userLoc };
  };

  const resolveCountry = (profileId, address) => {
    if (!address) return;
    geocodeOSM(address).then((r) => {
      if (r && r.country) {
        setProfiles((arr) => arr.map((p) => p.id === profileId ? { ...p, country: r.country } : p));
      }
    });
  };

  const runCommand = (raw) => {
    const cmd = raw.trim();
    if (!cmd) return null;

    if (chatMode) {
      const result = interpretChat(cmd, profiles, chatPending);
      if (!result) return null;
      if (result.exit) { setChatMode(false); setChatPending(null); return result.lines; }
      if (result.newProfiles) setProfiles(result.newProfiles);
      if (result.pendingAction !== undefined) setChatPending(result.pendingAction);
      if (result.countryRefresh) resolveCountry(result.countryRefresh.profileId, result.countryRefresh.address);
      if (result.nearestRequest) {
        return findNearestProfile(profiles).then(({ profile, distKm }) => {
          if (!profile) return [{ kind: "err", text: "> no geocodable profiles found" }];
          const km = distKm.toFixed(1);
          const mi = (distKm * 0.621371).toFixed(1);
          return [
            { kind: "acc", text: `> nearest :: ${profile.firstName} ${profile.lastName}  [${profile.id}]` },
            `  address  :: ${profile.address}`,
            `  distance :: ${km} km  (${mi} mi)`,
          ];
        }).catch((err) => [{ kind: "err", text: `> geolocation error :: ${err.message || err}` }]);
      }
      return result.lines;
    }

    const [head, ...rest] = cmd.split(/\s+/);
    const args = rest.join(" ");
    const name = head.toLowerCase();
    switch (name) {
      case "help":
      case "?":
        return [
          { kind: "acc", text: "PERSONA_DB v0.1.1 — fictional persona database (cyberpunk roleplay)." },
          "",
          "WHAT THIS DOES:",
          "  · stores fictional profiles: name, DOB, ethnicity, sex, address, contacts, notes",
          "  · carousel: ←/→ keys, swipe, drag, or click pips to navigate cards",
          "  · click a card to view a full record :: DOWNLOAD .json to export it",
          "  · EDIT to amend a record :: DELETE to remove :: + NEW for a new entry",
          "  · MAP opens a Leaflet/OSM world view (pins via Nominatim geocoding)",
          "  · click any address in a record to fly the map to that pin",
          "  · search bar above the carousel filters which cards are visible",
          "",
          "COMMANDS:",
          { kind: "cmd-row", cmd: "help",         desc: "this screen" },
          { kind: "cmd-row", cmd: "count",        desc: "total + filtered counts" },
          { kind: "cmd-row", cmd: "find <query>", desc: "set the carousel filter" },
          { kind: "cmd-row", cmd: "clear-filter", desc: "remove the filter (alias: reset)" },
          { kind: "cmd-row", cmd: "scope <field>",desc: "set filter scope (all|firstname|lastname|dob|...)" },
          { kind: "cmd-row", cmd: "goto <n|id|name>", desc: "jump carousel to entry" },
          { kind: "cmd-row", cmd: "open <n|id|name>", desc: "open a record" },
          { kind: "cmd-row", cmd: "list",         desc: "list all profiles (alias: ls)" },
          { kind: "cmd-row", cmd: "map",          desc: "open the world map" },
          { kind: "cmd-row", cmd: "new",          desc: "create a new entry" },
          { kind: "cmd-row", cmd: "link",         desc: "pick the profile-image folder" },
          { kind: "cmd-row", cmd: "whoami",       desc: "prints current shell user" },
          { kind: "cmd-row", cmd: "date",         desc: "current UTC timestamp" },
          { kind: "cmd-row", cmd: "echo <text>",  desc: "prints the argument" },
          { kind: "cmd-row", cmd: "clear",        desc: "clear the terminal scrollback" },
          { kind: "cmd-row", cmd: "version",      desc: "prints version" },
          { kind: "cmd-row", cmd: "purge",        desc: "wipe all records (opens confirmation)" },
          { kind: "cmd-row", cmd: "download <name|id>", desc: "download a profile as .json" },
          { kind: "cmd-row", cmd: "distance <name|id>", desc: "show distance from your location to a profile" },
          { kind: "cmd-row", cmd: "chat",         desc: "enter natural-language query mode" },
          "",
          "AUDIO I/O:",
          { kind: "cmd-row", cmd: "mic enable",      desc: "microphone on — say 'Command <cmd>' to execute" },
          { kind: "cmd-row", cmd: "mic enable -c",   desc: "continuous mode — all speech executed as commands" },
          { kind: "cmd-row", cmd: "mic disable",     desc: "turn microphone off" },
          { kind: "cmd-row", cmd: "voice enable",    desc: "read terminal results aloud (text-to-speech)" },
          { kind: "cmd-row", cmd: "voice disable",   desc: "silence voice output" }
        ];
      case "purge":
        setPurgeOpen(true);
        return { kind: "acc", text: "⚠ purge confirmation required — confirm in the modal." };
      case "download": {
        if (!args) return { kind: "err", text: "usage: download <name|id>" };
        const q = args.toLowerCase();
        const target = profiles.find((p) =>
          (p.id || "").toLowerCase() === q ||
          (`${p.firstName} ${p.lastName}`).toLowerCase() === q ||
          p.firstName.toLowerCase() === q ||
          p.lastName.toLowerCase() === q
        );
        if (!target) return { kind: "err", text: `no match :: "${args}"` };
        const safe = (`${target.firstName}_${target.lastName}`).replace(/\s+/g, "_");
        downloadJSON(target, `${safe}_${target.id}.json`);
        return `> downloading :: ${safe}_${target.id}.json`;
      }
      case "distance": {
        if (!args) return [{ kind: "err", text: "usage: distance <name|id>" }];
        const dq = args.toLowerCase();
        const dtarget = profiles.find((p) =>
          (p.id || "").toLowerCase() === dq ||
          `${p.firstName} ${p.lastName}`.toLowerCase() === dq ||
          p.firstName.toLowerCase() === dq ||
          p.lastName.toLowerCase() === dq
        );
        if (!dtarget) return [{ kind: "err", text: `no match :: "${args}"` }];
        if (!dtarget.address) return [{ kind: "err", text: `no address on record :: ${dtarget.firstName} ${dtarget.lastName}  [${dtarget.id}]` }];
        return getUserLocation().then(async (userLoc) => {
          let geo = geocodeCached(dtarget.address);
          if (geo === undefined) geo = await geocodeOSM(dtarget.address);
          if (!geo) return [{ kind: "err", text: `> could not geocode :: "${dtarget.address}"` }];
          const distKm = haversineKm(userLoc.lat, userLoc.lng, geo.lat, geo.lng);
          const km = distKm.toFixed(1);
          const mi = (distKm * 0.621371).toFixed(1);
          return [
            { kind: "acc", text: `> ${dtarget.firstName} ${dtarget.lastName}  [${dtarget.id}]` },
            `  address  :: ${dtarget.address}`,
            `  distance :: ${km} km  (${mi} mi)`,
          ];
        }).catch((err) => [{ kind: "err", text: `> geolocation error :: ${err.message || err}` }]);
      }
      case "chat":
        setChatMode(true);
        return [
          { kind: "acc", text: "> chat mode — ask questions about your data in plain english." },
          "  type 'help' for examples  ·  type 'exit' to return to shell",
        ];
      case "clear":
      case "cls":
        return "__clear__";
      case "count":
        return [
          "total    :: " + profiles.length,
          "filtered :: " + filtered.length,
          "query    :: " + (query || "(none)"),
          "scope    :: " + field
        ];
      case "find":
      case "filter":
      case "search":
      case "grep":
        setQuery(args);
        return [{ kind: "acc", text: "filter set :: " + (args || "(empty)") }];
      case "clear-filter":
      case "clearfilter":
      case "reset":
      case "unfilter":
        setQuery("");
        setField("all");
        return [{ kind: "acc", text: "filter cleared" }];
      case "scope":
      case "field": {
        const f = (args || "").toLowerCase();
        const valid = FIELDS.find((x) => x.id.toLowerCase() === f || x.label.toLowerCase() === f);
        if (!valid) return [{ kind: "err", text: "? unknown scope :: " + (f || "(empty)") }, { kind: "dim", text: "valid: " + FIELDS.map((x) => x.id).join(", ") }];
        setField(valid.id);
        return [{ kind: "acc", text: "scope :: " + valid.id }];
      }
      case "goto": {
        const t = findProfileByRef(args);
        if (t.idx == null) return [{ kind: "err", text: "? entry not found :: " + (args || "(empty)") }];
        setIndex(t.idx);
        return [{ kind: "acc", text: "→ [" + (t.idx + 1).toString().padStart(2, "0") + "] " + t.profile.firstName + " " + t.profile.lastName }];
      }
      case "open": {
        const t = findProfileByRef(args);
        if (t.idx == null) return [{ kind: "err", text: "? entry not found :: " + (args || "(empty)") }];
        setIndex(t.idx);
        setOpenProfile(t.profile);
        return [{ kind: "acc", text: "opened :: " + t.profile.id + " · " + t.profile.firstName + " " + t.profile.lastName }];
      }
      case "ls":
      case "list":
        if (profiles.length === 0) return [{ kind: "dim", text: "(no records)" }];
        return profiles.slice(0, 100).map((p, i) =>
          "[" + (i + 1).toString().padStart(2, "0") + "] " + (p.id || "").padEnd(8, " ") + "  " +
          (p.firstName + " " + p.lastName).padEnd(28, " ") + "  " + (p.dob || "—")
        );
      case "map":
        setMapFocusId(null);
        setMapOpen(true);
        return [{ kind: "acc", text: "map :: opening" }];
      case "new":
        setNewOpen(true);
        return [{ kind: "acc", text: "new entry :: form opened" }];
      case "link":
      case "link-folder":
      case "linkfolder":
        pickDirectory();
        return [{ kind: "acc", text: "folder picker :: opened" }];
      case "whoami":
        return "root";
      case "date":
      case "time":
        return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
      case "version":
      case "ver":
        return "PERSONA_DB v0.1.1";
      case "classified": {
        const arg = (args || "").toLowerCase();
        if (arg !== "enable" && arg !== "disable" && arg !== "on" && arg !== "off") {
          return [{ kind: "err", text: "usage: classified <enable|disable>" }];
        }
        const next = (arg === "enable" || arg === "on");
        if (next) {
          if (classifiedPin) {
            const pin = window.prompt("Enter classified PIN to enable:", "");
            if (pin == null) return [{ kind: "err", text: "classified :: PIN entry cancelled" }];
            if (pin !== classifiedPin) return [{ kind: "err", text: "classified :: PIN incorrect" }];
          } else {
            const pin = window.prompt("Set a new classified PIN:", "");
            if (pin == null || !pin.trim()) return [{ kind: "err", text: "classified :: PIN creation cancelled" }];
            const confirm = window.prompt("Confirm new classified PIN:", "");
            if (confirm == null) return [{ kind: "err", text: "classified :: PIN creation cancelled" }];
            if (pin !== confirm) return [{ kind: "err", text: "classified :: PIN confirmation mismatch" }];
            try { localStorage.setItem(CLASSIFIED_PIN_KEY, pin); } catch (e) {}
            setClassifiedPin(pin);
            showToast("> classified PIN set");
          }
        }
        setClassifiedMode(next);
        return next
          ? [{ kind: "acc", text: "classified :: ENABLED — restricted records now visible" }]
          : [{ kind: "acc", text: "classified :: DISABLED — restricted records hidden" }];
      }
      case "echo":
        return args;
      case "save":
        try {
          saveAllState(profiles, dirName, classifiedPin);
          try { markSaved(); } catch (e) {}
          showToast(`> saved :: ${profiles.length} record(s)`);
          return { kind: "acc", text: `> saved :: ${profiles.length} record(s)` };
        } catch (e) {
          return { kind: "err", text: "save failed" };
        }
      case "exit":
      case "logout":
        return [{ kind: "dim", text: "nope — this shell is going nowhere." }];
      default:
        return [
          { kind: "err", text: "? unknown command :: " + head },
          { kind: "dim", text: "type 'help' for the command list" }
        ];
    }
  };

  const terminalBanner = useMemo(() => ([
    { kind: "acc", text: "persona_db shell — type 'help' for commands." }
  ]), []);

  const onSelect = (p) => setOpenProfile(p);
  const onNew = () => setNewOpen(true);

  const onImportDemo = async () => {
    try {
      const resp = await fetch("./demo.json");
      if (!resp.ok) throw new Error("fetch failed: " + resp.status);
      const data = await resp.json();
      if (!Array.isArray(data)) { showToast("> demo :: invalid format"); return; }
      const incoming = data.map(normalizeProfile);
      const existingIds = new Set(profiles.map((p) => p.id));
      const toAdd = incoming.filter((p) => !existingIds.has(p.id));
      const skipped = incoming.length - toAdd.length;
      setProfiles((arr) => [...arr, ...toAdd]);
      setQuery("");
      setField("all");
      const msg = skipped > 0
        ? `> demo imported :: ${toAdd.length} added, ${skipped} duplicate(s) skipped`
        : `> demo imported :: ${toAdd.length} profile(s) added`;
      showToast(msg);
    } catch (e) {
      showToast("> demo :: load failed");
    }
  };

  const onSaveNew = (profile, isEdit) => {
    if (isEdit) {
      setProfiles((arr) => arr.map((x) => x.id === profile.id ? profile : x));
      const i = profiles.findIndex((x) => x.id === profile.id);
      if (i >= 0) setIndex(i);
      setEditTarget(null);
      setOpenProfile(profile);
      showToast(`> entry patched :: ${profile.id}`);
    } else {
      setProfiles((arr) => [...arr, profile]);
      setNewOpen(false);
      setQuery("");
      setField("all");
      setIndex(profiles.length);
      showToast(`> entry committed :: ${profile.id}`);
    }
    resolveCountry(profile.id, profile.address);
  };

  const onEdit = (profile) => {
    setOpenProfile(null);
    setEditTarget(profile);
  };

  const onToggleFlag = (profile, key) => {
    setProfiles((arr) => arr.map((x) => x.id === profile.id ? { ...x, [key]: !x[key] } : x));
    setOpenProfile((cur) => cur && cur.id === profile.id ? { ...cur, [key]: !cur[key] } : cur);
  };

  const onOpenRefId = (refId) => {
    if (!refId) return;
    const target = profiles.find((x) => (x.id || "").toLowerCase() === String(refId).toLowerCase());
    if (!target) { showToast(`> ref-id not found :: ${refId}`); return; }
    setOpenProfile(target);
  };

  const onDelete = (profile) => {
    setProfiles((arr) => arr.filter((x) => x.id !== profile.id));
    setOpenProfile(null);
    setIndex(0);
    showToast(`> record purged :: ${profile.id}`);
  };

  const onPurgeConfirm = () => {
    const count = profiles.length;
    setProfiles([]);
    setOpenProfile(null);
    setIndex(0);
    setQuery("");
    setField("all");
    setPurgeOpen(false);
    showToast(`> purge complete :: ${count} record(s) deleted`);
  };

  const handleBackup = () => {
    saveAllState(profiles, dirName, classifiedPin);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `persona_db_${dt}.json`;
    const payload = { profiles, dirName: dirName || null, classifiedPin: classifiedPin || null, exportedAt: now.toISOString() };
    downloadJSON(payload, filename);
    showToast(`> backup saved :: ${filename}`);
  };

  const handleRestoreConfirm = () => {
    setRestoreOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    const removeInput = () => {
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 300);
    };
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) { removeInput(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const arr = extractProfilesFromBackup(data).map(normalizeProfile);
          saveProfiles(arr);
          setProfiles(arr);
          if (data && data.dirName) { try { setDirName(data.dirName); } catch (e) {} }
          if (data && data.classifiedPin) {
            try { localStorage.setItem(CLASSIFIED_PIN_KEY, data.classifiedPin); } catch (e) {}
            setClassifiedPin(data.classifiedPin);
          }
          setOpenProfile(null);
          setIndex(0);
          setQuery("");
          setField("all");
          showToast(`> restore complete :: ${arr.length} record(s) loaded`);
        } catch (err) {
          showToast("> restore failed :: invalid json");
        }
        removeInput();
      };
      reader.readAsText(file);
    };
    input.addEventListener("cancel", removeInput, { once: true });
    document.body.appendChild(input);
    input.click();
  };

  const mergeDuplicates = useCallback(() => {
    const map = new Map();
    let mergedCount = 0;
    profiles.forEach((p) => {
      const key = (p.id || "").toLowerCase() || ((p.firstName || "").toLowerCase() + "|" + (p.lastName || "").toLowerCase() + "|" + (p.dob || ""));
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { ...p, contacts: Array.isArray(p.contacts) ? [...p.contacts] : [], relationships: Array.isArray(p.relationships) ? [...p.relationships] : [], tags: Array.isArray(p.tags) ? [...p.tags] : [] });
      } else {
        mergedCount++;
        const existing = map.get(key);
        const merged = { ...existing };
        ["firstName","lastName","dob","ethnicity","sex","address","description","image","country","status"].forEach((f) => {
          if ((!merged[f] || merged[f] === "") && p[f]) merged[f] = p[f];
        });
        if (!merged.imageData && p.imageData) merged.imageData = p.imageData;
        const uniq = (a, b) => {
          const seen = new Set((a || []).map((x) => JSON.stringify(x)));
          const out = (a || []).slice();
          (b || []).forEach((x) => { const s = JSON.stringify(x); if (!seen.has(s)) { out.push(x); seen.add(s); } });
          return out;
        };
        merged.contacts = uniq(existing.contacts, p.contacts);
        merged.relationships = uniq(existing.relationships, p.relationships);
        merged.tags = uniq(existing.tags, p.tags);
        map.set(key, merged);
      }
    });
    const mergedArr = Array.from(map.values());
    setProfiles(mergedArr);
    showToast(`> merged duplicates :: ${mergedCount} merged`);
    return mergedCount;
  }, [profiles, setProfiles]);

  const byImageRef = useMemo(() => {
    const m = {};
    profiles.forEach((p) => { if (p.image) m[p.image.toLowerCase()] = p; });
    return m;
  }, [profiles]);

  const combinedResolve = useCallback((ref) => {
    if (!ref) return null;
    const real = resolve(ref);
    if (real) return real;
    const p = byImageRef[(ref || "").toLowerCase()];
    if (p && p.imageData) return p.imageData;
    return null;
  }, [resolve, byImageRef]);

  return html`
    <div className="shell">
      <${TopBar} count=${profiles.length} />

      <div className="main">
        <aside className="leftrail terminal-rail">
          <div className="panel-head">
            <span>// SHELL</span><span className="bar" />
            <span className="blink">_</span>
          </div>
          <${Terminal} fullrail runCommand=${runCommand} banner=${terminalBanner} chatMode=${chatMode} />
        </aside>

        <section className="stage">
          <div className="stage-head">
            <div className="breadcrumbs">
              <span>/db/</span><b>profiles/</b><span>browse</span>
              <span className="dim"> &nbsp;//&nbsp; idx </span>
              <b>${String(Math.min(index + 1, filtered.length + 1)).padStart(2, "0")}</b>
              <span className="dim"> / ${String(filtered.length + 1).padStart(2, "0")}</span>
              ${query && html`<span className="dim"> &nbsp;//&nbsp; <span className="amber">filtered</span>: ${filtered.length}/${profiles.length}</span>`}
              ${classifiedMode && html`<span className="dim"> &nbsp;//&nbsp; <span style=${{ color: "var(--red)" }}>CLEARANCE: HIGH</span></span>`}
            </div>
            <div className="stage-controls">
              <button className="ctrl-btn" onClick=${() => { setMapFocusId(null); setMapOpen(true); }}>[ MAP ]</button>
              <button className="ctrl-btn" onClick=${() => setRelOpen(true)}>[ RELATIONSHIPS ]</button>
              <button className="ctrl-btn" onClick=${pickDirectory}>
                ${dirName ? "RE-LINK FOLDER" : "LINK IMG FOLDER"}
              </button>
              <button className="ctrl-btn" onClick=${mergeDuplicates}>DEDUP</button>
              <button className="ctrl-btn" onClick=${onImportDemo}>DEMO</button>
              <button className="ctrl-btn" onClick=${() => setRestoreOpen(true)}>⇩ RESTORE</button>
              <button className="ctrl-btn" onClick=${handleBackup}>⇧ BACKUP</button>
              <button className="ctrl-btn primary" onClick=${onNew}>+ NEW</button>
              <button className="ctrl-btn danger" onClick=${() => setPurgeOpen(true)}>⚠ PURGE</button>
            </div>
          </div>

          <${SearchStrip}
            query=${query}
            setQuery=${setQuery}
            field=${field}
            setField=${setField}
            filtered=${filtered.length}
            total=${profiles.length}
          />

          <${Carousel}
            profiles=${filtered}
            index=${index}
            setIndex=${setIndex}
            onSelect=${onSelect}
            onNew=${onNew}
            resolveImg=${combinedResolve}
          />

          <div className="pager">
            ${filtered.map((p, i) => html`
              <span key=${p.id}
                    className=${"pip " + (i === index ? "on" : "")}
                    onClick=${() => setIndex(i)} />
            `)}
            <span className=${"pip " + (index === filtered.length ? "on" : "")}
                  onClick=${() => setIndex(filtered.length)}
                  style=${{ borderLeft: "1px dashed var(--line-2)", marginLeft: 4, paddingLeft: 6 }} />
          </div>
        </section>
      </div>

      <footer className="statusbar">
        <div className="seg">
          <span><span className="dot" /> ENC:AES-256</span>
          <span>STORE: <b>localStorage</b></span>
          <span>IMG: <b>${dirName || "—"}</b></span>
        </div>
        <div className="seg">
          <span>NAV: <span className="kbd">←</span><span className="kbd">→</span></span>
          <span>OPEN: <span className="kbd">ENTER</span></span>
          <span>SWIPE: <span className="kbd">touch</span></span>
          ${saved && html`<span className="saved-ind on">SAVED</span>`}
        </div>
      </footer>

      ${openProfile && html`
        <${DetailModal}
          profile=${openProfile}
          onClose=${() => setOpenProfile(null)}
          onDelete=${onDelete}
          resolveImg=${combinedResolve}
          onOpenMap=${(p) => { setOpenProfile(null); setMapOpen(true); setMapFocusId(p.id); }}
          onEdit=${onEdit}
          onToggleFlag=${onToggleFlag}
          onOpenRefId=${onOpenRefId}
        />
      `}
      ${newOpen && html`
        <${NewEntryModal} onClose=${() => setNewOpen(false)} onSave=${onSaveNew} />
      `}
      ${editTarget && html`
        <${NewEntryModal}
          initial=${editTarget}
          onClose=${() => { setEditTarget(null); setOpenProfile(editTarget); }}
          onSave=${onSaveNew}
        />
      `}
      ${mapOpen && html`
        <${MapModal}
          profiles=${classifiedMode ? profiles : profiles.filter((p) => !p.classified)}
          focusId=${mapFocusId}
          onClose=${() => { setMapOpen(false); setMapFocusId(null); }}
          onSelect=${(p) => { setMapOpen(false); setMapFocusId(null); setOpenProfile(p); }}
        />
      `}
      ${purgeOpen && html`
        <${PurgeModal}
          count=${profiles.length}
          onConfirm=${onPurgeConfirm}
          onClose=${() => setPurgeOpen(false)}
        />
      `}
      ${restoreOpen && html`
        <${RestoreModal}
          count=${profiles.length}
          onConfirm=${handleRestoreConfirm}
          onClose=${() => setRestoreOpen(false)}
        />
      `}
      ${relOpen && html`
        <${RelationshipsModal}
          profiles=${classifiedMode ? profiles : profiles.filter((p) => !p.classified)}
          onClose=${() => setRelOpen(false)}
          onSelect=${(p) => { setRelOpen(false); setOpenProfile(p); }}
        />
      `}
      ${toast && html`<div className="toast">${toast}</div>`}
    </div>
  `;
}
