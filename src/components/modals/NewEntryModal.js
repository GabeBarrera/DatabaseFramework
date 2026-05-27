import { useState, useEffect, useRef } from "react";
import { html } from "htm/react";
import { Glitch } from "../Glitch.js";
import { CONTACT_TYPES } from "../../constants/contacts.js";
import { RELATIONSHIP_TYPES } from "../../constants/relationships.js";

export function NewEntryModal({ onClose, onSave, initial }) {
  const editing = !!initial;
  const [form, setForm] = useState({
    firstName: initial ? initial.firstName || "" : "",
    lastName: initial ? initial.lastName || "" : "",
    dob: initial ? initial.dob || "" : "",
    ethnicity: initial ? initial.ethnicity || "" : "",
    sex: initial ? initial.sex || "" : "",
    address: initial ? initial.address || "" : "",
    description: initial ? initial.description || "" : "",
    image: initial ? initial.image || "" : "",
    country: initial ? initial.country || "" : "",
    status: initial ? initial.status || "" : ""
  });
  const [imgPreview, setImgPreview] = useState(initial && initial.imageData ? initial.imageData : null);
  const [errors, setErrors] = useState({});
  const [contacts, setContacts] = useState(initial && Array.isArray(initial.contacts) ? initial.contacts.map((c) => ({ ...c })) : []);
  const [relationships, setRelationships] = useState(initial && Array.isArray(initial.relationships) ? initial.relationships.map((r) => ({ ...r })) : []);
  const [flags, setFlags] = useState({
    poi: initial ? !!initial.poi : false,
    hidden: initial ? !!initial.hidden : false,
    classified: initial ? !!initial.classified : false
  });
  const [tagsString, setTagsString] = useState(
    initial && Array.isArray(initial.tags) ? initial.tags.join(", ")
    : (initial && typeof initial.tags === "string" ? initial.tags : "")
  );
  const [importErr, setImportErr] = useState(null);
  const importRef = useRef(null);
  const toggleFlag = (k) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          dob: data.dob || "",
          ethnicity: data.ethnicity || "",
          sex: data.sex || "",
          address: data.address || "",
          description: data.description || "",
          image: data.image || "",
          country: data.country || "",
          status: data.status || ""
        });
        if (data.imageData) setImgPreview(data.imageData);
        if (Array.isArray(data.contacts)) setContacts(data.contacts.map((c) => ({ ...c })));
        if (Array.isArray(data.relationships)) setRelationships(data.relationships.map((r) => ({ ...r })));
        if (Array.isArray(data.tags)) setTagsString(data.tags.join(", "));
        else if (typeof data.tags === "string") setTagsString(data.tags);
        setFlags({ poi: !!data.poi, hidden: !!data.hidden, classified: !!data.classified });
        setErrors({});
        setImportErr(null);
      } catch (_) {
        setImportErr("invalid json");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const addContact = () => setContacts((c) => [...c, { type: "email", value: "" }]);
  const updateContact = (i, patch) => setContacts((c) => c.map((row, k) => k === i ? { ...row, ...patch } : row));
  const removeContact = (i) => setContacts((c) => c.filter((_, k) => k !== i));

  const addRelationship = () => setRelationships((r) => [...r, { type: "friend", name: "", refId: "" }]);
  const updateRelationship = (i, patch) => setRelationships((r) => r.map((row, k) => k === i ? { ...row, ...patch } : row));
  const removeRelationship = (i) => setRelationships((r) => r.filter((_, k) => k !== i));

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePic = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgPreview(reader.result);
      set("image", f.name);
    };
    reader.readAsDataURL(f);
  };

  const submit = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = "required";
    if (!form.lastName.trim()) errs.lastName = "required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const newId = editing ? initial.id : ("P-0x" + (Math.floor(Math.random() * 0xfff)).toString(16).toUpperCase().padStart(3, "0"));
    const cleanContacts = contacts
      .map((c) => ({ type: c.type, value: (c.value || "").trim() }))
      .filter((c) => c.value);
    const cleanRelationships = relationships
      .map((r) => ({
        type: r.type || "other",
        name: (r.name || "").trim(),
        refId: (r.refId || "").trim()
      }))
      .filter((r) => r.name || r.refId);
    const profile = {
      id: newId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dob: form.dob,
      ethnicity: form.ethnicity.trim(),
      sex: form.sex,
      address: form.address.trim(),
      description: form.description.trim(),
      image: form.image || "",
      country: form.country.trim(),
      status: form.status,
      contacts: cleanContacts,
      relationships: cleanRelationships,
      tags: (tagsString || "").split(",").map((t) => t.trim()).filter(Boolean),
      poi: !!flags.poi,
      hidden: !!flags.hidden,
      classified: !!flags.classified
    };
    if (imgPreview) profile.imageData = imgPreview;
    onSave(profile, editing);
  };

  const contactPlaceholder = (type) => {
    if (type === "email") return "user@domain.tld";
    if (type === "phone") return "+1 555 123 4567";
    if (type === "website") return "https://…";
    if (type === "x" || type === "telegram" || type === "instagram") return "@handle";
    if (type === "discord") return "handle#0000";
    return "value";
  };

  return html`
    <div className="modal-veil" onMouseDown=${(e) => { if (e.target.classList.contains("modal-veil")) onClose(); }}>
      <div className="modal" style=${{ width: "min(920px, 100%)" }}>
        <div className="modal-head">
          <div className="tag">${editing ? "EDIT" : "CREATE"}</div>
          <h3>> <${Glitch} className="glitch-sm">${editing ? `PATCH_ENTRY :: ${initial.id}` : "NEW_ENTRY.appendix()"}<//>
          </h3>
          <div style=${{ display: "flex", gap: 8, alignItems: "center" }}>
            ${importErr && html`<span style=${{ color: "var(--red)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>[ ${importErr} ]</span>`}
            <input ref=${importRef} type="file" accept=".json,application/json" onChange=${handleImport} style=${{ display: "none" }} />
            <button className="ctrl-btn" onClick=${() => importRef.current && importRef.current.click()} title="populate fields from a .json file">⇪ IMPORT</button>
            <button className="ctrl-btn" onClick=${onClose}>✕ ESC</button>
          </div>
        </div>

        <div className="form-grid">
          <div className="picshell">
            <label style=${{ color: "var(--grn-3)", fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase" }}>Profile Picture</label>
            <label className="pic">
              <input type="file" accept="image/*" onChange=${handlePic} style=${{ display: "none" }} />
              ${imgPreview
                ? html`<img src=${imgPreview} alt="" />`
                : html`<div className="ph-text">
                    <span className="glyph">⊕</span>
                    click to upload
                    <div style=${{ color: "var(--dim)", marginTop: 6, fontSize: 10 }}>jpg / png</div>
                  </div>`
              }
            </label>
            <div style=${{ color: "var(--dim)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              filename → <span style=${{ color: "var(--grn-1)", textTransform: "none", letterSpacing: 0 }}>${form.image || "—"}</span>
            </div>
          </div>

          <div className="form-rows">
            <div className="row">
              <label>First Name <span className="req">*</span></label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${form.firstName} onChange=${(e) => set("firstName", e.target.value)} autoFocus />
              </div>
              ${errors.firstName && html`<div className="err">[ ${errors.firstName} ]</div>`}
            </div>
            <div className="row">
              <label>Last Name <span className="req">*</span></label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${form.lastName} onChange=${(e) => set("lastName", e.target.value)} />
              </div>
              ${errors.lastName && html`<div className="err">[ ${errors.lastName} ]</div>`}
            </div>
            <div className="row">
              <label>Date of Birth</label>
              <div className="input-wrap"><span className="pfx">></span>
                <input type="date" value=${form.dob} onChange=${(e) => set("dob", e.target.value)} />
              </div>
            </div>
            <div className="row">
              <label>Sex</label>
              <div className="input-wrap"><span className="pfx">></span>
                <select value=${form.sex} onChange=${(e) => set("sex", e.target.value)}>
                  <option value="">[ select ]</option>
                  <option value="M">M / Male</option>
                  <option value="F">F / Female</option>
                  <option value="NB">NB / Non-binary</option>
                  <option value="X">X / Unspecified</option>
                </select>
              </div>
            </div>
            <div className="row">
              <label>Status</label>
              <div className="input-wrap"><span className="pfx">></span>
                <select value=${form.status} onChange=${(e) => set("status", e.target.value)}>
                  <option value="">[ unknown ]</option>
                  <option value="alive">Alive</option>
                  <option value="deceased">Deceased</option>
                </select>
              </div>
            </div>
            <div className="row full">
              <label>Ethnicity</label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${form.ethnicity} onChange=${(e) => set("ethnicity", e.target.value)} placeholder="e.g. South Asian, Mixed, Latina" />
              </div>
            </div>
            <div className="row full">
              <label>Address</label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${form.address} onChange=${(e) => set("address", e.target.value)} placeholder="last known location" />
              </div>
            </div>
            <div className="row full">
              <label>Country <span style=${{ color: "var(--dim)", fontSize: 10, letterSpacing: "0.1em" }}>auto-detected from address</span></label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${form.country} onChange=${(e) => set("country", e.target.value)} placeholder="e.g. Germany" />
              </div>
            </div>
            <div className="row full">
              <label>Tags <span style=${{ color: "var(--dim)", fontSize: 10, letterSpacing: "0.1em" }}>comma-separated</span></label>
              <div className="input-wrap"><span className="pfx">></span>
                <input value=${tagsString} onChange=${(e) => setTagsString(e.target.value)} placeholder="e.g. suspect, local, vip" />
              </div>
            </div>
            <div className="row full">
              <label>Description</label>
              <div className="input-wrap" style=${{ alignItems: "flex-start" }}>
                <span className="pfx">></span>
                <textarea className="area" value=${form.description} onChange=${(e) => set("description", e.target.value)} placeholder="notes, affiliations, known patterns…" />
              </div>
            </div>

            <div className="contacts-block">
              <div className="head">
                <span>// CONTACT_METHODS</span>
                <span className="dim">${contacts.length} pending</span>
              </div>
              ${contacts.length === 0
                ? html`<div className="contacts-empty">— none yet · click "+ add contact method" below —</div>`
                : contacts.map((c, i) => html`
                    <div className="contact-row" key=${i}>
                      <div className="input-wrap">
                        <span className="pfx">@</span>
                        <select value=${c.type} onChange=${(e) => updateContact(i, { type: e.target.value })}>
                          ${CONTACT_TYPES.map((t) => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}
                        </select>
                      </div>
                      <div className="input-wrap">
                        <span className="pfx">></span>
                        <input
                          value=${c.value}
                          onChange=${(e) => updateContact(i, { value: e.target.value })}
                          placeholder=${contactPlaceholder(c.type)}
                        />
                      </div>
                      <button type="button" className="icon-btn" title="remove" onClick=${() => removeContact(i)}>✕</button>
                    </div>
                  `)
              }
              <div>
                <button type="button" className="ctrl-btn" onClick=${addContact}>+ ADD CONTACT METHOD</button>
              </div>
            </div>

            <div className="contacts-block">
              <div className="head">
                <span>// RELATIONSHIPS</span>
                <span className="dim">${relationships.length} pending</span>
              </div>
              ${relationships.length === 0
                ? html`<div className="contacts-empty">— none yet · click "+ add relationship" below —</div>`
                : relationships.map((r, i) => html`
                    <div className="rel-row" key=${i}>
                      <div className="input-wrap">
                        <span className="pfx">~</span>
                        <select value=${r.type} onChange=${(e) => updateRelationship(i, { type: e.target.value })}>
                          ${RELATIONSHIP_TYPES.map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
                        </select>
                      </div>
                      <div className="input-wrap">
                        <span className="pfx">></span>
                        <input
                          value=${r.name}
                          onChange=${(e) => updateRelationship(i, { name: e.target.value })}
                          placeholder="name"
                        />
                      </div>
                      <div className="input-wrap">
                        <span className="pfx">#</span>
                        <input
                          value=${r.refId}
                          onChange=${(e) => updateRelationship(i, { refId: e.target.value })}
                          placeholder="ref-id (optional)"
                        />
                      </div>
                      <button type="button" className="icon-btn" title="remove" onClick=${() => removeRelationship(i)}>✕</button>
                    </div>
                  `)
              }
              <div>
                <button type="button" className="ctrl-btn" onClick=${addRelationship}>+ ADD RELATIONSHIP</button>
              </div>
            </div>

            <div className="contacts-block">
              <div className="head">
                <span>// FLAGS</span>
                <span className="dim">${Object.values(flags).filter(Boolean).length} active</span>
              </div>
              <div className="status-toggles" style=${{ paddingTop: 4 }}>
                <button
                  type="button"
                  className=${"status-toggle poi " + (flags.poi ? "on" : "")}
                  onClick=${() => toggleFlag("poi")}
                  title="Point of Interest — pinned to top of carousel"
                >★ POI</button>
                <button
                  type="button"
                  className=${"status-toggle hidden " + (flags.hidden ? "on" : "")}
                  onClick=${() => toggleFlag("hidden")}
                  title="Hidden — never sent to the geocoder, won't appear on the map"
                >◌ HIDDEN</button>
                <button
                  type="button"
                  className=${"status-toggle classified " + (flags.classified ? "on" : "")}
                  onClick=${() => toggleFlag("classified")}
                  title="Classified — removed from carousel and search until shell unlocks it"
                >▮ CLASSIFIED</button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <div className="foot-hint">
            <span className="kbd">⌘</span> required fields marked with <span className="amber">*</span>
          </div>
          <div className="foot-actions">
            <button className="ctrl-btn" onClick=${onClose}>cancel</button>
            <button className="ctrl-btn primary" onClick=${submit}>> ${editing ? "patch_entry()" : "commit_entry()"}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
