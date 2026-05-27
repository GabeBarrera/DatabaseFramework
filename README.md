# //PERSONA_DB

A modular, browser-based persona database with a cyberpunk CRT aesthetic. Built with React 18 (via ESM CDN, no build step required) and Leaflet/OpenStreetMap. Open `index.html` directly in any modern browser, or deploy as a static site on GitHub Pages.

## Architecture

No build step, no Babel, no Webpack. Uses native ES modules with an **importmap** for CDN dependencies and **htm** tagged template literals as a JSX replacement.

```
index.html              ← importmap + CSS links + <script type="module">
src/
  main.js               ← ReactDOM.createRoot entry point
  App.js                ← root component, all state and command routing
  components/
    Glitch.js           ← animated glitch text span
    TopBar.js           ← clock + record count header
    SearchStrip.js      ← search input + field chips + match pill
    carousel/
      Carousel.js       ← swipeable card track
      ProfileCard.js    ← individual profile card
      NewEntryCard.js   ← "+ New Entry" placeholder card
      ProfileList.js    ← alphabetical list view (alternate to carousel)
    terminal/
      Terminal.js       ← shell + mic/voice I/O
    modals/
      DetailModal.js    ← read-only record view
      NewEntryModal.js  ← create / edit form
      MapModal.js       ← Leaflet world map
      PurgeModal.js     ← destructive wipe confirmation
      RestoreModal.js   ← restore-from-backup confirmation + demo import
      RelationshipsModal.js ← SVG force-directed relationship graph
  lib/
    storage.js          ← localStorage keys, load/save, registerGeocodeSaver
    geocode.js          ← Nominatim geocoding + cache, haversineKm, getUserLocation
    utils.js            ← ageFrom, fmtDate, initials, sexLong, downloadJSON, escapeHTML
    graph.js            ← buildRelGraph, forceLayout (custom physics)
    chat.js             ← natural-language chat interpreter
  hooks/
    useImageDir.js      ← File System Access API / input[webkitdirectory] image folder
  constants/
    contacts.js         ← CONTACT_TYPES, contactMeta()
    relationships.js    ← RELATIONSHIP_TYPES, FAMILY_TYPES, PC_TYPES, REL_REVERSE
    fields.js           ← FIELDS, FIELD_ALIASES
  styles/
    base.css            ← :root variables, reset, scrollbars, toast, kbd
    animations.css      ← @keyframes
    layout.css          ← shell, topbar, leftrail, stage, statusbar, dropdowns
    card.css            ← carousel, cards, pager, profile list
    modal.css           ← modals, portrait, field-grid, contacts-list
    terminal.css        ← terminal, mic/voice toolbar
    form.css            ← create/edit form grid
    map.css             ← Leaflet overrides, cyber-pin, map-list
    relationships.css   ← SVG graph layout
demo.json               ← 8 example personas
```

## Running

Open `index.html` in any modern browser — no server required for local use.

For GitHub Pages or any static host, push the repo root as-is. The importmap fetches React and htm from `esm.sh` on first load.

> **HTTPS required for mic/voice and geolocation features** (browser security restriction). `localhost` also works.

## Features

### Profile Management
- **Create, edit, and delete** fictional persona records. Required fields: first name and last name. Optional fields: date of birth, sex, ethnicity, address, country, status, description, and profile image.
- **Sex options**: M, F, NB, X.
- **Country**: auto-detected from the address field via Nominatim geocoding.
- **Status**: marks a profile as `Alive` or `Deceased`. Color-coded on the card and in the detail modal.
- **Contacts**: email, phone, Signal, Telegram, Discord, X, Instagram, GitHub, LinkedIn, IRC, Keybase, Matrix, Session, XMPP, website, and other.
- **Relationships**: link profiles with a labeled type (friend, spouse, colleague, rival, etc.).
- **POI flag**: Person of Interest — POI entries sort to the top of the carousel and list view, alphabetically.
- **Hidden flag**: exclude a profile from map geocoding and the relationship graph.
- **Classified flag**: hide behind a terminal PIN (`classified enable` command).

### Carousel View
- Horizontal card carousel, navigated with **← / → arrow keys**, mouse drag, or touch swipe.
- Center card is active; adjacent cards are scaled and dimmed.
- Click a card to open its full detail modal.

### List View
- Toggle between the carousel and a compact alphabetical list using the **LIST / CARDS** button in the toolbar.
- POIs appear first (alphabetically), followed by all other profiles (also alphabetically by last name, then first name).
- Columns: Name, Ref ID, DOB / Age, Sex, Ethnicity, Status, Address.
- No images — focused on data at a glance. Click any row to open the detail modal.

### Search & Filter
- Real-time filter above the carousel/list. Scope to any field via the chip bar.

### Detail Modal
- All fields, clickable contact links, relationship links.
- **Download JSON**, **Toggle flags**, **Open on Map**.

### Relationship Graph
- Full-screen SVG force-directed graph. Nodes are draggable. Edges color-coded by type.

### World Map (Leaflet / OpenStreetMap)
- Geocoding via **Nominatim** (1 req/sec, cached in `localStorage`).
- Dark tiles (CARTO), cyber-styled pins, crosshair on active pin.

### Proximity Features
- **`distance <name|id>`** terminal command: uses the browser Geolocation API to compute the straight-line distance (km and miles) from your current location to a profile's address.
- **Chat nearest-profile query**: phrases like `"who is closest to me"`, `"identify the closest person"`, or `"which profile is nearby"` geocode all profiles and return the nearest one with distance.

### Toolbar
- **MAP** / **RELATIONSHIPS** / **LIST** — primary navigation buttons (orange accent).
- **RE-LINK** — re-link the profile image folder (hover for tooltip). Shows as **LINK IMG FOLDER** when no folder is linked yet.
- **⇩ RESTORE** / **⇧ BACKUP** — JSON import/export.
- **EDIT ▾** — dropdown menu containing:
  - **+ NEW** — open the create-profile form
  - **DEDUP** — merge profiles with matching IDs or first+last+DOB
  - **⚠ PURGE** — wipe all records (opens confirmation modal)

### Terminal / Shell
Commands: `list`/`ls`, `find`/`grep <query>`, `goto`, `open`, `download`, `distance`, `map`, `new`, `link`, `count`, `scope`, `clear-filter`, `date`, `version`, `echo`, `clear`, `save`, `purge`, `chat`, `help`.

**Audio I/O (HTTPS required):**
- `mic enable` — keyword mode: say **"Command \<cmd\>"** to execute
- `mic enable -c` — continuous mode: every utterance runs as a command
- `mic disable` — turn off microphone
- `voice enable` / `voice disable` — text-to-speech for terminal output

**Chat mode** (`chat`): natural-language queries and edits. Type `exit` to return to shell.

Example chat queries:
```
who is closest to me
identify the nearest profile
how many profiles are there
who has a birthday in march
who is older than 40
who lives in berlin
who is related to john
tell me about jane smith
set jane's address to 123 main st
delete relationship between alice and bob
```

### Data Persistence
- Profiles stored in `localStorage` (`personaDB::v3`).
- Geocode cache stored separately (`personaDB::geocode::v2`).
- **DEMO** — loads the 8 example personas from `demo.json` (skips duplicates by ID). Accessed via the **⇩ RESTORE** modal.
- **⇧ BACKUP** / **⇩ RESTORE** for JSON export/import.

## Stack

| Dependency | Version | Purpose |
|---|---|---|
| React | 18 | UI and state (ESM via esm.sh) |
| htm | 3 | JSX-free tagged template literals |
| Leaflet | 1.9.4 | Interactive map (global script) |
| OpenStreetMap / Nominatim | — | Tile rendering and geocoding |
| JetBrains Mono / VT323 | — | Monospace and CRT fonts |

No build tooling or package manager needed.

## htm Syntax Reference

```js
import { html } from "htm/react";

// JSX → htm
<div className={cls}>           → html`<div className=${cls}>`
<Comp prop={val} />             → html`<${Comp} prop=${val} />`
{cond && <el />}                → ${cond && html`<el />`}
{arr.map(x => <el />)}         → ${arr.map(x => html`<el />`)}
```
