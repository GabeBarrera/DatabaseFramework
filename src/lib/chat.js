import { FIELD_ALIASES } from "../constants/fields.js";
import { REL_REVERSE } from "../constants/relationships.js";

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const QUESTION_WORDS = /^(who|what|which|where|when|how|is|are|do|does|did|will|would|can|could|should)$/;

export function interpretChat(query, profiles, pending) {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const findProfile = (nameStr) => {
    const n = nameStr.toLowerCase().trim();
    return profiles.find((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase() === n ||
      p.firstName.toLowerCase() === n ||
      p.lastName.toLowerCase() === n ||
      (p.id || "").toLowerCase() === n
    );
  };

  const createProfileEntry = (firstName, lastName) => {
    const id = "P-0x" + Math.floor(Math.random() * 0xfff).toString(16).toUpperCase().padStart(3, "0");
    const newProfile = {
      id, firstName, lastName,
      dob: "", ethnicity: "", sex: "", address: "", description: "", image: "",
      country: "", status: "",
      contacts: [], relationships: [], poi: false, hidden: false, classified: false,
    };
    const lines = [{ kind: "acc", text: `> created :: ${firstName} ${lastName}  [${id}]` }];
    if (firstName === "[unknown]") lines.push({ kind: "err", text: `  firstName → [unknown]  ← set with: set ${lastName}'s first name to ...` });
    if (lastName  === "[unknown]") lines.push({ kind: "err", text: `  lastName  → [unknown]  ← set with: set ${firstName}'s last name to ...` });
    return { lines, newProfiles: [...profiles, newProfile], pendingAction: null };
  };

  const fmt = (ps, label) => {
    if (!ps.length) return [{ kind: "dim", text: `> no results :: ${label}` }];
    return [
      `> ${ps.length} match(es) :: ${label}`,
      ...ps.map((p) => `  · ${p.firstName} ${p.lastName}  [${p.id}]`),
    ];
  };

  if (pending) {
    if (pending.type === "nameQuestion") {
      if (/^(first|first name|f|fn)$/.test(q)) return createProfileEntry(pending.name, "[unknown]");
      if (/^(last|last name|l|ln|surname)$/.test(q)) return createProfileEntry("[unknown]", pending.name);
      if (/^(no|cancel|n|abort)$/.test(q)) return { lines: ["  aborted"], pendingAction: null };
      return { lines: [{ kind: "acc", text: `> is "${pending.name}" a first or last name? type 'first' or 'last'` }], pendingAction: pending };
    }
    if (pending.type === "deleteProfile") {
      if (/^(yes|confirm|y)$/.test(q))
        return { lines: [{ kind: "acc", text: `> deleted :: ${pending.displayName}  [${pending.profileId}]` }], newProfiles: profiles.filter((p) => p.id !== pending.profileId), pendingAction: null };
      if (/^(no|cancel|n|abort)$/.test(q)) return { lines: ["  aborted"], pendingAction: null };
      return { lines: [{ kind: "acc", text: `> ⚠ pending: delete ${pending.displayName} — type 'confirm' or 'cancel'` }], pendingAction: pending };
    }
  }

  if (/^(exit|quit|bye|leave|:q|end|stop)$/.test(q))
    return { exit: true, pendingAction: null, lines: ["> returning to shell"] };

  if (/^help/.test(q))
    return { lines: [
      { kind: "acc", text: "chat mode — query and edit your data in plain english:" },
      "",
      "QUERIES:",
      "  how many profiles are there",
      "  who has a birthday in [month]",
      "  who was born in [year]",
      "  who is older / younger than [age]",
      "  who lives in [place]",
      "  who is [ethnicity]",
      "  who is male / female / nonbinary",
      "  who has [signal / telegram / github / ...]",
      "  who is a POI / hidden / classified",
      "  who is related to [name]",
      "  tell me about [name]",
      "  find people who [keyword]",
      "  who is closest to me / nearest profile / identify the closest person",
      "",
      "MUTATIONS:",
      "  [name] is [name]'s [relation]          — e.g. josh is kevin's parent",
      "  [name] is [a/the] [rel] of [name]      — e.g. josh is the parent of kevin",
      "  [name] and [name] are [rel]s            — e.g. josh and kevin are friends",
      "  link [name] and [name] as [rel]         — e.g. link josh and kevin as rivals",
      "  delete relationship between [A] and [B] — removes link from both sides",
      "  unlink [name] and [name]                — same as above",
      "  [name] is dead / died / passed away      — marks status as deceased",
      "  [name] is alive                          — marks status as alive",
      "  set [name]'s [field] to [value]         — e.g. set josh's description to ...",
      "  update [field] for [name] to [value]",
      "  [name]'s [field] is now [value]",
      "  delete/clear [name]'s [field]           — e.g. delete josh's birthday",
      "  delete [field] in [name]                — e.g. delete birthday in josh",
      "  delete [name]                           — deletes profile (asks confirmation)",
      "  add [first] [last]                      — creates a new profile",
      "  add [name]                              — creates profile, asks first or last name",
      "",
      "  exit — return to shell",
    ]};

  if (/how many/.test(q)) return { lines: [`> ${profiles.length} profile(s) in the database`] };

  const monthTest = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/);
  if (monthTest && /birthday|born|dob/.test(q)) {
    const abbr = monthTest[1].slice(0, 3);
    const mIdx = MONTHS.findIndex((m) => m.startsWith(abbr));
    const res = profiles.filter((p) => p.dob && parseInt(p.dob.split("-")[1], 10) === mIdx + 1);
    return { lines: fmt(res, `birthday in ${MONTHS[mIdx]}`) };
  }

  const yearTest = q.match(/\b(19|20)\d{2}\b/);
  if (yearTest && /born|dob|birthday/.test(q)) {
    const res = profiles.filter((p) => p.dob && p.dob.startsWith(yearTest[0]));
    return { lines: fmt(res, `born in ${yearTest[0]}`) };
  }

  const ageTest = q.match(/\b(older than|over|under|younger than|age)\s+(\d+)/);
  if (ageTest) {
    const n = parseInt(ageTest[2], 10);
    const over = /older|over/.test(ageTest[1]);
    const now = new Date();
    const res = profiles.filter((p) => {
      if (!p.dob) return false;
      const d = new Date(p.dob);
      const age = now.getFullYear() - d.getFullYear() -
        (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
      return over ? age > n : age < n;
    });
    return { lines: fmt(res, `age ${over ? "over" : "under"} ${n}`) };
  }

  if (/\bpoi\b|person of interest/.test(q)) return { lines: fmt(profiles.filter((p) => p.poi), "POI") };
  if (/\bhidden\b/.test(q)) return { lines: fmt(profiles.filter((p) => p.hidden), "hidden") };
  if (/\bclassified\b/.test(q)) return { lines: fmt(profiles.filter((p) => p.classified), "classified") };

  if (/\b(male|man|men)\b/.test(q) && !/female|woman|women/.test(q))
    return { lines: fmt(profiles.filter((p) => p.sex === "M"), "sex: M") };
  if (/\b(female|woman|women)\b/.test(q))
    return { lines: fmt(profiles.filter((p) => p.sex === "F"), "sex: F") };
  if (/\b(nonbinary|non-binary|\bnb\b|enby)\b/.test(q))
    return { lines: fmt(profiles.filter((p) => p.sex === "NB"), "sex: NB") };

  const contactTypes = ["email","phone","signal","telegram","discord","x","instagram","github","linkedin","irc","keybase","matrix","session","xmpp","website"];
  for (const ct of contactTypes) {
    if (new RegExp(`\\b${ct}\\b`).test(q)) {
      const res = profiles.filter((p) => (p.contacts || []).some((c) => c.type === ct));
      return { lines: fmt(res, `contact: ${ct}`) };
    }
  }

  const relMatch = q.match(/(?:related to|knows?|connected to|linked to|associate of|friend of|works? with)\s+([a-z\s\-]+)/);
  if (relMatch) {
    const name = relMatch[1].trim();
    const res = profiles.filter((p) => (p.relationships || []).some((r) => r.name.toLowerCase().includes(name)));
    return { lines: fmt(res, `related to "${name}"`) };
  }

  const aboutMatch = q.match(/(?:tell me about|describe|who is|what do you know about|info on|show me)\s+([a-z0-9\s\-]+)/);
  if (aboutMatch) {
    const name = aboutMatch[1].trim();
    const p = profiles.find((x) =>
      `${x.firstName} ${x.lastName}`.toLowerCase().includes(name) ||
      x.firstName.toLowerCase() === name ||
      x.lastName.toLowerCase() === name ||
      (x.id || "").toLowerCase() === name
    );
    if (p) {
      const lines = [{ kind: "acc", text: `> ${p.firstName} ${p.lastName}  [${p.id}]` }];
      if (p.dob) {
        const d = new Date(p.dob);
        const now = new Date();
        const age = now.getFullYear() - d.getFullYear() -
          (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
        lines.push(`  DOB       :: ${p.dob}  (age ${age})`);
      }
      if (p.sex)         lines.push(`  sex       :: ${p.sex}`);
      if (p.ethnicity)   lines.push(`  ethnicity :: ${p.ethnicity}`);
      if (p.address)     lines.push(`  address   :: ${p.address}`);
      if (p.description) lines.push(`  notes     :: ${p.description}`);
      if (p.contacts && p.contacts.length)
        lines.push(`  contacts  :: ${p.contacts.map((c) => `${c.type}: ${c.value}`).join("  ·  ")}`);
      if (p.relationships && p.relationships.length)
        lines.push(`  links     :: ${p.relationships.map((r) => `${r.type}: ${r.name}`).join("  ·  ")}`);
      return { lines };
    }
  }

  if (/closest|nearest|nearby|near me|close to me/.test(q) && /person|profile|someone|who|people|identify/.test(q))
    return { lines: [{ kind: "dim", text: "> locating nearest profile..." }], nearestRequest: true };

  const locMatch = q.match(/(?:lives? in|from|based in|located in|in)\s+([a-z\s,\-]+?)(?:\?|$)/);
  if (locMatch && /lives?|from|based|located/.test(q)) {
    const place = locMatch[1].trim();
    const res = profiles.filter((p) => p.address && p.address.toLowerCase().includes(place));
    if (res.length) return { lines: fmt(res, `in "${place}"`) };
  }

  { const m = q.match(/^(?:delete|remove|unlink)\s+(?:the\s+)?(?:\w+\s+)?relationship\s+between\s+(.+?)\s+and\s+(.+?)(?:\s*\?)?$/);
    if (m) {
      const profA = findProfile(m[1].trim()), profB = findProfile(m[2].trim());
      if (!profA) return { lines: [{ kind: "err", text: `> profile not found :: "${m[1].trim()}"` }] };
      if (!profB) return { lines: [{ kind: "err", text: `> profile not found :: "${m[2].trim()}"` }] };
      const hadA = (profA.relationships || []).some((r) => r.refId === profB.id);
      const hadB = (profB.relationships || []).some((r) => r.refId === profA.id);
      if (!hadA && !hadB) return { lines: [{ kind: "dim", text: `> no relationship found between ${profA.firstName} ${profA.lastName} and ${profB.firstName} ${profB.lastName}` }] };
      return {
        lines: [{ kind: "acc", text: `> unlinked :: ${profA.firstName} ${profA.lastName}  ↔  ${profB.firstName} ${profB.lastName}` }],
        newProfiles: profiles.map((p) => {
          if (p.id === profA.id) return { ...p, relationships: (p.relationships || []).filter((r) => r.refId !== profB.id) };
          if (p.id === profB.id) return { ...p, relationships: (p.relationships || []).filter((r) => r.refId !== profA.id) };
          return p;
        }),
      };
    }
  }

  { const m = q.match(/^unlink\s+(.+?)\s+and\s+(.+?)(?:\s*\?)?$/) ||
               q.match(/^(?:delete|remove)\s+(.+?)'s\s+relationship\s+with\s+(.+?)(?:\s*\?)?$/);
    if (m) {
      const profA = findProfile(m[1].trim()), profB = findProfile(m[2].trim());
      if (!profA) return { lines: [{ kind: "err", text: `> profile not found :: "${m[1].trim()}"` }] };
      if (!profB) return { lines: [{ kind: "err", text: `> profile not found :: "${m[2].trim()}"` }] };
      return {
        lines: [{ kind: "acc", text: `> unlinked :: ${profA.firstName} ${profA.lastName}  ↔  ${profB.firstName} ${profB.lastName}` }],
        newProfiles: profiles.map((p) => {
          if (p.id === profA.id) return { ...p, relationships: (p.relationships || []).filter((r) => r.refId !== profB.id) };
          if (p.id === profB.id) return { ...p, relationships: (p.relationships || []).filter((r) => r.refId !== profA.id) };
          return p;
        }),
      };
    }
  }

  const applyFieldUpdate = (nameRaw, fieldRaw, value) => {
    const fieldKey = FIELD_ALIASES[fieldRaw.trim().toLowerCase()];
    if (!fieldKey) return { lines: [{ kind: "err", text: `> unknown field :: "${fieldRaw.trim()}" — valid: firstName, lastName, dob, sex, ethnicity, address, country, status, description` }] };
    const p = findProfile(nameRaw.trim());
    if (!p) return { lines: [{ kind: "err", text: `> profile not found :: "${nameRaw.trim()}"` }] };
    let normalized = value.trim();
    if (fieldKey === "status") {
      if (/^(dead|deceased|died|gone)$/.test(normalized)) normalized = "deceased";
      else if (/^(alive|living)$/.test(normalized)) normalized = "alive";
    }
    const result = {
      lines: [{ kind: "acc", text: `> updated :: ${p.firstName} ${p.lastName}  [${p.id}]` }, `  ${fieldKey} → "${normalized}"`],
      newProfiles: profiles.map((x) => x.id === p.id ? { ...x, [fieldKey]: normalized } : x),
    };
    if (fieldKey === "address") result.countryRefresh = { profileId: p.id, address: normalized };
    return result;
  };
  { const m = q.match(/^(?:set|update|change)\s+(.+?)'s\s+(.+?)\s+to\s+(.+)$/);
    if (m) return applyFieldUpdate(m[1], m[2], m[3]); }
  { const m = q.match(/^(?:set|update|change)\s+(.+?)\s+for\s+(.+?)\s+to\s+(.+)$/);
    if (m && FIELD_ALIASES[m[1].trim().toLowerCase()]) return applyFieldUpdate(m[2], m[1], m[3]); }
  { const m = q.match(/^(.+?)'s\s+(.+?)\s+is\s+now\s+(.+)$/);
    if (m && !QUESTION_WORDS.test(m[1].trim().toLowerCase())) return applyFieldUpdate(m[1], m[2], m[3]); }

  const applyClearField = (nameRaw, fieldRaw) => {
    const fieldKey = FIELD_ALIASES[fieldRaw.trim().toLowerCase()];
    if (!fieldKey) return { lines: [{ kind: "err", text: `> unknown field :: "${fieldRaw.trim()}"` }] };
    if (fieldKey === "firstName" || fieldKey === "lastName")
      return { lines: [{ kind: "err", text: `> cannot clear required field :: ${fieldKey}` }] };
    const p = findProfile(nameRaw.trim());
    if (!p) return { lines: [{ kind: "err", text: `> profile not found :: "${nameRaw.trim()}"` }] };
    return {
      lines: [{ kind: "acc", text: `> cleared :: ${p.firstName} ${p.lastName}  [${p.id}]  — ${fieldKey}` }],
      newProfiles: profiles.map((x) => x.id === p.id ? { ...x, [fieldKey]: "" } : x),
    };
  };
  { const m = q.match(/^(?:delete|clear|remove)\s+(.+?)'s\s+(.+?)(?:\s*\?)?$/);
    if (m && FIELD_ALIASES[m[2].trim().toLowerCase()]) return applyClearField(m[1], m[2]); }
  { const m = q.match(/^(?:delete|clear|remove)\s+(.+?)\s+(?:in|for|from|of)\s+(.+?)(?:\s*\?)?$/);
    if (m && FIELD_ALIASES[m[1].trim().toLowerCase()]) return applyClearField(m[2], m[1]); }

  const applyRelLink = (aName, bName, relTypeRaw) => {
    if (QUESTION_WORDS.test(aName.trim().toLowerCase())) return null;
    const profA = findProfile(aName.trim()), profB = findProfile(bName.trim());
    if (!profA && !profB) return { lines: [{ kind: "err", text: `> profiles not found :: "${aName.trim()}" and "${bName.trim()}"` }] };
    if (!profA) return { lines: [{ kind: "err", text: `> profile not found :: "${aName.trim()}"` }] };
    if (!profB) return { lines: [{ kind: "err", text: `> profile not found :: "${bName.trim()}"` }] };
    const rel = relTypeRaw.trim().toLowerCase();
    const reverse = REL_REVERSE[rel] !== undefined ? REL_REVERSE[rel] : rel;
    const addLink = (p, link) => {
      const rels = (p.relationships || []).filter((r) => r.refId !== link.refId);
      return [...rels, link];
    };
    return {
      lines: [
        { kind: "acc", text: `> linked :: ${profA.firstName} ${profA.lastName}  ↔  ${profB.firstName} ${profB.lastName}` },
        `  ${profA.firstName} ${profA.lastName} → ${rel} → ${profB.firstName} ${profB.lastName}`,
        `  ${profB.firstName} ${profB.lastName} → ${reverse} → ${profA.firstName} ${profA.lastName}`,
      ],
      newProfiles: profiles.map((p) => {
        if (p.id === profA.id) return { ...p, relationships: addLink(p, { type: rel,     name: `${profB.firstName} ${profB.lastName}`, refId: profB.id }) };
        if (p.id === profB.id) return { ...p, relationships: addLink(p, { type: reverse, name: `${profA.firstName} ${profA.lastName}`, refId: profA.id }) };
        return p;
      }),
    };
  };
  { const m = q.match(/^(.+?)\s+is\s+(.+?)'s\s+([\w ]+?)(?:\s*\?)?$/);
    if (m) { const r = applyRelLink(m[1], m[2], m[3]); if (r) return r; } }
  { const m = q.match(/^(.+?)\s+is\s+(?:a\s+|the\s+)?([\w ]+?)\s+of\s+(.+?)(?:\s*\?)?$/);
    if (m) { const r = applyRelLink(m[1], m[3], m[2]); if (r) return r; } }
  { const m = q.match(/^(.+?)\s+and\s+(.+?)\s+are\s+([\w ]+?)s?(?:\s*\?)?$/);
    if (m) {
      let rel = m[3].trim();
      if (!Object.prototype.hasOwnProperty.call(REL_REVERSE, rel) && Object.prototype.hasOwnProperty.call(REL_REVERSE, rel.replace(/s$/, ""))) rel = rel.replace(/s$/, "");
      const r = applyRelLink(m[1], m[2], rel); if (r) return r;
    }
  }
  { const m = q.match(/^link\s+(.+?)\s+and\s+(.+?)\s+as\s+([\w ]+?)(?:\s*\?)?$/);
    if (m) { const r = applyRelLink(m[1], m[2], m[3]); if (r) return r; } }

  { const deceased = q.match(/^(.+?)\s+(?:is\s+)?(?:dead|deceased|died|passed away|is gone|is no longer alive)(?:\s*\?)?$/) ||
                     q.match(/^(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:dead|deceased)(?:\s*\?)?$/);
    if (deceased) { const p = findProfile(deceased[1].trim()); if (p) return { lines: [{ kind: "acc", text: `> status updated :: ${p.firstName} ${p.lastName}  [${p.id}]` }, "  status → deceased"], newProfiles: profiles.map((x) => x.id === p.id ? { ...x, status: "deceased" } : x) }; }
  }
  { const alive = q.match(/^(.+?)\s+is\s+(?:alive|living|still alive)(?:\s*\?)?$/) ||
                  q.match(/^(?:mark|set)\s+(.+?)\s+(?:as\s+)?alive(?:\s*\?)?$/);
    if (alive) { const p = findProfile(alive[1].trim()); if (p) return { lines: [{ kind: "acc", text: `> status updated :: ${p.firstName} ${p.lastName}  [${p.id}]` }, "  status → alive"], newProfiles: profiles.map((x) => x.id === p.id ? { ...x, status: "alive" } : x) }; }
  }

  { const m = q.match(/^(?:delete|remove)\s+(?:profile\s+|record\s+|user\s+)?(.+?)(?:\s*\?)?$/);
    if (m) {
      const p = findProfile(m[1].trim());
      if (p) return {
        lines: [{ kind: "acc", text: `> ⚠ delete ${p.firstName} ${p.lastName}  [${p.id}]` }, "  type 'confirm' to proceed  ·  type 'cancel' to abort"],
        pendingAction: { type: "deleteProfile", profileId: p.id, displayName: `${p.firstName} ${p.lastName}` },
      };
    }
  }

  { const m = q.match(/^(?:add|create|new profile|new record|new entry|add profile|add record)\s+(.+?)(?:\s*\?)?$/);
    if (m) {
      const raw = m[1].trim();
      const parts = raw.split(/\s+/);
      if (parts.length >= 2) return createProfileEntry(parts[0], parts.slice(1).join(" "));
      return { lines: [{ kind: "acc", text: `> is "${raw}" a first or last name? type 'first' or 'last'` }], pendingAction: { type: "nameQuestion", name: raw } };
    }
  }

  const kwMatch = q.match(/(?:find|show|list|who|people|anyone|someone|profiles?)\s+(?:who |that |with |are |is |identify(?:ing)? as |work(?:s|ing)? (?:as|in) |(?:have|has) )?(.+)/);
  const keyword = (kwMatch ? kwMatch[1] : q).replace(/\?$/, "").trim();
  if (keyword.length >= 2) {
    const words = keyword.split(/\s+/);
    const res = profiles.filter((p) => {
      const blob = [
        p.firstName, p.lastName, p.description, p.ethnicity, p.address, p.sex,
        ...(p.contacts || []).map((c) => c.value),
        ...(p.relationships || []).map((r) => `${r.name} ${r.type}`),
      ].join(" ").toLowerCase();
      return words.every((w) => blob.includes(w));
    });
    if (res.length) return { lines: fmt(res, `"${keyword}"`) };
    return { lines: [{ kind: "dim", text: `> no results :: "${keyword}"` }] };
  }

  return { lines: [{ kind: "dim", text: "> couldn't parse that — try 'help' for examples" }] };
}
