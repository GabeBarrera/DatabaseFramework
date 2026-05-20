# //PERSONA_DB

A single-file, browser-based persona database with a cyberpunk CRT aesthetic. Built with React 18 (via CDN, no build step required) and Leaflet/OpenStreetMap. Open `index.html` directly in any modern browser.

## Features

### Profile Management
- **Create, edit, and delete** fictional persona records with fields for: first/last name, date of birth, ethnicity, sex, address, description, and a profile image reference.
- **Contacts**: attach multiple contact methods per profile (phone, email, Telegram, X, Instagram, GitHub, Signal, Keybase, website).
- **Relationships**: link profiles to one another with a labeled relationship type (friend, spouse, colleague, rival, etc.).
- **POI flag**: mark a profile as a Person of Interest — POI entries sort to the top of the carousel alphabetically.
- **Classified flag**: hide sensitive records behind a hidden shell toggle (`classified` command in the terminal). Classified profiles are invisible in normal mode.

### Carousel View
- Profiles are displayed as cards in a horizontally scrollable carousel.
- Navigate with **← / → arrow keys**, mouse drag, or touch swipe.
- The center card is the active selection; adjacent cards are scaled and dimmed.
- Click any card to open its full detail modal.
- A **+ NEW** card at the end of the carousel opens the creation form.

### Search & Filter
- A search bar above the carousel filters the visible cards in real time.
- Filter scope can be set to `all` fields or scoped to a specific field (name, DOB, address, etc.).
- Filter chips below the search bar offer quick-access field toggles.

### Detail Modal
- Displays all profile fields, contacts (with clickable links), and relationships (with links to open referenced profiles).
- **Download JSON**: exports the selected profile as a `.json` file.
- **Toggle POI / Classified** status directly from the modal.
- **Open on Map**: flies the world map to the profile's geocoded address.

### World Map (Leaflet / OpenStreetMap)
- A full-screen map view showing pins for every profile that has a geocoded address.
- Geocoding is performed via the **Nominatim API** (OSM), serialized to respect the 1 req/sec rate limit, with results cached in `localStorage`.
- Click a pin to see a popup with the profile's name and address; click through to open the detail modal.
- A side list panel shows all mapped profiles; clicking one flies the map to that pin.
- Custom zoom controls and a cyberpunk-styled Leaflet skin (dark tiles, green markers).

### Terminal
- A command-line interface at the bottom of the screen accepts text commands for power users.
- Key commands: `list`/`ls`, `find <query>`, `goto <n|id|name>`, `open <n|id|name>`, `map`, `new`, `link`, `count`, `scope <field>`, `clear-filter`, `date`, `echo`, `clear`, `help`.
- Hidden commands unlock classified mode and allow database purge.

### Image Directory
- Point the app at a local folder of images via the **File System Access API** (Chromium) or a fallback `<input webkitdirectory>` picker.
- Profile image fields are matched to files in the folder by filename (case-insensitive, with and without extension).
- Linked folder name is remembered in `localStorage` across sessions.

### Data Persistence
- All profiles are stored in `localStorage` under the key `personaDB::v3`.
- Geocode results are cached separately under `personaDB::geocode::v1`.
- **Export**: individual profiles can be downloaded as JSON from the detail modal.
- **Import**: the edit/create form accepts a JSON paste to pre-populate fields.
- A **purge** command wipes all user-created records and resets to seed data.

## Seed Data

Eight fictional personas are bundled as seed data and loaded on first run (or after a purge). They demonstrate all supported fields including relationships, contacts, POI status, and classified status.

## Stack

| Dependency | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI components and state |
| Babel Standalone | 7.29.0 | JSX transpilation in-browser |
| Leaflet | 1.9.4 | Interactive map |
| OpenStreetMap / Nominatim | — | Tile rendering and geocoding |
| JetBrains Mono / VT323 | — | Monospace and CRT fonts |

No build tooling or package manager is needed. The file runs standalone.
