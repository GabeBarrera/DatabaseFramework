import { useState, useEffect, useRef } from "react";
import { html } from "htm/react";
import { Glitch } from "../Glitch.js";
import { fmtDate, sexLong, escapeHTML } from "../../lib/utils.js";
import { geocodeOSM, geocodeCached } from "../../lib/geocode.js";

export function MapModal({ profiles, onClose, onSelect, focusId }) {
  const stageRef = useRef(null);
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const userLocRef = useRef(null);
  const [active, setActive] = useState(focusId || null);
  const [pins, setPins] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, status: "idle" });
  const [unresolved, setUnresolved] = useState([]);
  const [zoom, setZoom] = useState(2);
  const [locStatus, setLocStatus] = useState("pending");
  const [listOpen, setListOpen] = useState(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const m = L.map(mapDivRef.current, {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 18,
      zoomSnap: 0.25,
      wheelDebounceTime: 30
    }).setView([20, 0], 2);

    if (m.attributionControl) m.attributionControl.setPrefix(false);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        '&middot; tiles <a href="https://carto.com/attributions">CARTO</a> ' +
        '&middot; geocoding <a href="https://nominatim.openstreetmap.org/">Nominatim</a>',
      subdomains: "abcd",
      maxZoom: 19,
      className: "cyber-tiles"
    }).addTo(m);

    m.on("zoomend", () => setZoom(m.getZoom()));
    mapRef.current = m;

    setTimeout(() => m.invalidateSize(), 80);

    if (navigator.geolocation) {
      setLocStatus("pending");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll = [pos.coords.latitude, pos.coords.longitude];
          userLocRef.current = ll;
          try { m.setView(ll, 9, { animate: true }); } catch (e) {}
          setLocStatus("granted");
        },
        () => { setLocStatus("denied"); },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
      );
    } else {
      setLocStatus("unavailable");
    }

    return () => { try { m.remove(); } catch (e) {} mapRef.current = null; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const eligible = profiles.filter((p) => !p.hidden);
      const total = eligible.length;
      setProgress({ done: 0, total, status: total ? "geocoding" : "idle" });
      const out = [];
      const missing = [];
      let done = 0;
      const queue = [];
      profiles.forEach((p) => {
        if (p.hidden) return;
        if (!p.address) { missing.push(p); done++; return; }
        const cached = geocodeCached(p.address);
        if (cached === undefined) {
          queue.push(p);
        } else if (cached) {
          out.push({ profile: p, lat: cached.lat, lng: cached.lng, display: cached.display });
          done++;
        } else {
          missing.push(p);
          done++;
        }
      });
      if (!cancelled) {
        setPins([...out]);
        setUnresolved([...missing]);
        setProgress({ done, total, status: queue.length ? "geocoding" : "ready" });
      }
      for (const p of queue) {
        if (cancelled) return;
        const r = await geocodeOSM(p.address);
        done++;
        if (cancelled) return;
        if (r) {
          out.push({ profile: p, lat: r.lat, lng: r.lng, display: r.display });
          setPins([...out]);
        } else {
          missing.push(p);
          setUnresolved([...missing]);
        }
        setProgress({ done, total, status: done >= total ? "ready" : "geocoding" });
      }
    })();
    return () => { cancelled = true; };
  }, [profiles]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    Object.values(markersRef.current).forEach((mk) => { try { mk.remove(); } catch (e) {} });
    markersRef.current = {};

    pins.forEach((p) => {
      const isActive = p.profile.id === active;
      const label = (p.profile.firstName || "") + " " + (p.profile.lastName ? p.profile.lastName.charAt(0) + "." : "");
      const pinHtml =
        '<div class="hit"></div>' +
        (isActive ? '<div class="square"></div>' : '') +
        '<div class="ping"></div>' +
        '<div class="ring2"></div>' +
        '<div class="ring"></div>' +
        '<div class="core"></div>' +
        '<div class="label">' + escapeHTML(label) + '</div>';
      const icon = L.divIcon({
        html: pinHtml,
        className: "cyber-pin" + (isActive ? " active" : ""),
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const marker = L.marker([p.lat, p.lng], { icon, riseOnHover: true }).addTo(m);

      const popupHtml =
        '<div class="cyber-popup">' +
          '<span class="id">' + escapeHTML(p.profile.id || "") + '</span>' +
          (p.profile.classified ? '<div class="cls-tag">▮ CLASSIFIED</div>' : '') +
          '<div class="nm">' + escapeHTML((p.profile.firstName || "") + " " + (p.profile.lastName || "")) + '</div>' +
          '<div class="row"><span class="k">DOB</span><span class="v">' + escapeHTML(fmtDate(p.profile.dob)) + '</span></div>' +
          '<div class="row"><span class="k">ETHN</span><span class="v">' + escapeHTML(p.profile.ethnicity || "—") + '</span></div>' +
          '<div class="row"><span class="k">SEX</span><span class="v">' + escapeHTML(sexLong(p.profile.sex)) + '</span></div>' +
          '<div class="ad">' + escapeHTML(p.profile.address || "") + '</div>' +
          '<button class="open-btn" data-pid="' + escapeHTML(p.profile.id) + '">&gt; open record</button>' +
        '</div>';

      marker.bindPopup(popupHtml, {
        closeButton: true,
        offset: [0, -6],
        maxWidth: 320,
        className: "cyber-popup-wrap"
      });
      marker.on("click", () => setActive(p.profile.id));
      marker.on("dblclick", (e) => { L.DomEvent.stopPropagation(e); onSelect(p.profile); });
      marker.on("popupopen", (ev) => {
        const node = ev.popup.getElement();
        if (!node) return;
        const btn = node.querySelector(".open-btn");
        if (btn) btn.addEventListener("click", () => onSelect(p.profile));
      });
      markersRef.current[p.profile.id] = marker;
    });

    if (pins.length > 0 && !focusId && locStatus !== "granted" && m.getZoom() <= 2) {
      try {
        const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
        m.fitBounds(bounds, { padding: [60, 60], maxZoom: 5, animate: true });
      } catch (e) {}
    }
  }, [pins, active]);

  const crosshairRef = useRef(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (crosshairRef.current) {
      try { crosshairRef.current.remove(); } catch (e) {}
      crosshairRef.current = null;
    }
    if (!active) return;
    const pin = pins.find((x) => x.profile.id === active);
    if (!pin) return;
    const group = L.layerGroup();
    L.polyline([[pin.lat, -180], [pin.lat, 180]], {
      color: "#00ff66", weight: 1.5, opacity: 1, interactive: false, className: "cross-line cross-lat"
    }).addTo(group);
    L.polyline([[-85, pin.lng], [85, pin.lng]], {
      color: "#00ff66", weight: 1.5, opacity: 1, interactive: false, className: "cross-line cross-lng"
    }).addTo(group);
    group.addTo(m);
    crosshairRef.current = group;
  }, [active, pins]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !focusId) return;
    const pin = pins.find((p) => p.profile.id === focusId);
    if (pin) {
      m.flyTo([pin.lat, pin.lng], 9, { duration: 0.9 });
      setActive(focusId);
      const mk = markersRef.current[focusId];
      if (mk) setTimeout(() => { try { mk.openPopup(); } catch (e) {} }, 950);
    }
  }, [focusId, pins.length]);

  useEffect(() => {
    const onR = () => mapRef.current && mapRef.current.invalidateSize();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const zoomIn = () => mapRef.current && mapRef.current.zoomIn();
  const zoomOut = () => mapRef.current && mapRef.current.zoomOut();
  const fit = () => {
    const m = mapRef.current;
    if (!m) return;
    if (pins.length === 0) { m.setView([20, 0], 2); return; }
    if (pins.length === 1) { m.setView([pins[0].lat, pins[0].lng], 6); return; }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    m.fitBounds(bounds, { padding: [60, 60], maxZoom: 6, animate: true });
  };

  const flyTo = (pin) => {
    const m = mapRef.current;
    if (!m) return;
    m.flyTo([pin.lat, pin.lng], Math.max(9, m.getZoom()), { duration: 0.7 });
    setActive(pin.profile.id);
    const mk = markersRef.current[pin.profile.id];
    if (mk) setTimeout(() => { try { mk.openPopup(); } catch (e) {} }, 720);
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 100;
  const locLabel = locStatus === "pending" ? "requesting…" : locStatus === "granted" ? "current location" : locStatus === "denied" ? "denied" : "n/a";

  return html`
    <div className="modal-veil" onMouseDown=${(e) => { if (e.target.classList.contains("modal-veil")) onClose(); }}>
      <div className="modal map-modal">
        <div className="modal-head">
          <div className="tag">RECON</div>
          <h3>> <${Glitch} className="glitch-sm">WORLD_MAP // ${pins.length} NODE(S)${unresolved.length ? " · " + unresolved.length + " UNRESOLVED" : ""}<//>
          </h3>
          <button className="ctrl-btn" onClick=${onClose}>✕ ESC</button>
        </div>

        <div ref=${stageRef} className="map-stage" style=${{ position: "relative" }}>
          <div className="map-overlay-tl">
            <div>// SRC: <b>OpenStreetMap / CARTO</b></div>
            <div>// GEO: <b>Nominatim</b></div>
            <div>// LOC: <b>${locLabel}</b></div>
            <div>// ZOOM: <b>${zoom.toFixed(2)}</b></div>
            <div>// PIN_LOCK: <b>${active || "—"}</b></div>
          </div>

          <div ref=${mapDivRef} style=${{ position: "absolute", inset: 0 }} />

          <div className=${"map-list" + (listOpen ? "" : " hidden")}>
            <div className="lhead">
              <span>// NODES // WORLD</span>
              <div style=${{ display: "flex", gap: 10, alignItems: "center" }}>
                <span>${pins.length.toString().padStart(2, "0")} / ${(pins.length + unresolved.length).toString().padStart(2, "0")}</span>
                <button className="list-toggle" onClick=${() => setListOpen((o) => !o)} title=${listOpen ? "hide list" : "show list"}>
                  ${listOpen ? "▲ HIDE" : "▼ SHOW"}
                </button>
              </div>
            </div>
            <div className="lbody">
              ${pins.length === 0 && unresolved.length === 0 && html`
                <div style=${{ padding: "20px 12px", color: "var(--dim)", fontSize: 11, letterSpacing: "0.12em" }}>
                  [ no addresses to plot ]
                </div>
              `}
              ${pins.map((p) => html`
                <div
                  key=${p.profile.id}
                  className=${"map-row " + (p.profile.id === active ? "on" : "")}
                  onClick=${() => flyTo(p)}
                  onDblClick=${() => onSelect(p.profile)}
                >
                  <div className="dot-s" />
                  <div>
                    <div className="nm">${p.profile.firstName} ${p.profile.lastName}</div>
                    <div className="lc">${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}</div>
                  </div>
                  <div className="co">${p.profile.id}</div>
                </div>
              `)}
              ${unresolved.length > 0 && html`
                <div className="off-head">
                  <span>// UNRESOLVED</span>
                  <span>${unresolved.length.toString().padStart(2, "0")}</span>
                </div>
              `}
              ${unresolved.map((p) => html`
                <div
                  key=${p.id}
                  className="map-row off"
                  onDblClick=${() => onSelect(p)}
                  title=${p.address ? "no Nominatim match for: " + p.address : "no address on file"}
                >
                  <div className="dot-s" />
                  <div>
                    <div className="nm">${p.firstName} ${p.lastName}</div>
                    <div className="lc">${p.address ? "geocode failed" : "no addr"}</div>
                  </div>
                  <div className="co">${p.id}</div>
                </div>
              `)}
            </div>
          </div>

          ${progress.status === "geocoding" && html`
            <div className="geo-veil">
              <div>// NOMINATIM // <b>${progress.done}/${progress.total}</b></div>
              <div>respecting 1 req/sec rate limit…</div>
              <div className="bar" style=${{ "--p": pct + "%" }} />
            </div>
          `}
        </div>

        <div className="modal-foot">
          <div className="foot-hint">
            <span className="kbd">drag</span> pan ·
            <span className="kbd">wheel</span> zoom ·
            <span className="kbd">click</span> popup ·
            <span className="kbd">2x</span> open record
          </div>
          <div className="foot-actions">
            <button className="ctrl-btn map-btn" onClick=${zoomIn} title="zoom in">+</button>
            <button className="ctrl-btn map-btn" onClick=${zoomOut} title="zoom out">−</button>
            <button
              className="ctrl-btn map-btn"
              onClick=${() => {
                const m = mapRef.current;
                if (!m || !userLocRef.current) return;
                m.flyTo(userLocRef.current, 11, { duration: 0.7 });
              }}
              disabled=${!userLocRef.current}
              style=${{ opacity: userLocRef.current ? 1 : 0.4 }}
              title="my location"
            >ME</button>
            <button className="ctrl-btn" onClick=${fit}>↺ FIT</button>
            <button
              className="ctrl-btn primary"
              onClick=${() => {
                const p = pins.find((x) => x.profile.id === active);
                if (p) onSelect(p.profile);
              }}
              disabled=${!active}
              style=${{ opacity: active ? 1 : 0.4 }}
            >
              > open record
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
