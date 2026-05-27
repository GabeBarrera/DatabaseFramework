export const CONTACT_TYPES = [
  { id: "email",    label: "Email",     glyph: "@",   href: (v) => "mailto:" + v },
  { id: "phone",    label: "Phone",     glyph: "☏",   href: (v) => "tel:" + v.replace(/\s/g, "") },
  { id: "signal",   label: "Signal",    glyph: "S",   href: null },
  { id: "telegram", label: "Telegram",  glyph: "T",   href: (v) => "https://t.me/" + v.replace(/^@/, "") },
  { id: "discord",  label: "Discord",   glyph: "D",   href: null },
  { id: "x",        label: "X",         glyph: "𝕏",   href: (v) => "https://x.com/" + v.replace(/^@/, "") },
  { id: "instagram",label: "Instagram", glyph: "Ig",  href: (v) => "https://instagram.com/" + v.replace(/^@/, "") },
  { id: "github",   label: "Github",    glyph: "</>", href: (v) => "https://github.com/" + v.replace(/^@/, "") },
  { id: "linkedin", label: "LinkedIn",  glyph: "in",  href: null },
  { id: "irc",      label: "IRC",       glyph: "#",   href: null },
  { id: "keybase",  label: "Keybase",   glyph: "K",   href: (v) => "https://keybase.io/" + v.replace(/^@/, "") },
  { id: "matrix",   label: "Matrix",    glyph: "[m]", href: null },
  { id: "session",  label: "Session",   glyph: "ss",  href: null },
  { id: "xmpp",     label: "XMPP",      glyph: "x:",  href: null },
  { id: "website",  label: "Website",   glyph: "🌐",  href: (v) => /^https?:/.test(v) ? v : "https://" + v },
  { id: "other",    label: "Other",     glyph: "?",   href: null },
];

const _map = Object.fromEntries(CONTACT_TYPES.map((c) => [c.id, c]));
export function contactMeta(typeId) {
  return _map[typeId] || { id: typeId, label: typeId || "—", glyph: "?", href: null };
}
