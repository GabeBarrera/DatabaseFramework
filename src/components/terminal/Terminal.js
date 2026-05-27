import { useState, useEffect, useRef } from "react";
import { html } from "htm/react";

function langLabel(lang) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang;
  } catch { return lang; }
}

function groupVoices(voices) {
  const usEn = [], otherEn = [], rest = [];
  voices.forEach(v => {
    const l = (v.lang || "").toLowerCase().replace("_", "-");
    if (l === "en-us") usEn.push(v);
    else if (l.startsWith("en")) otherEn.push(v);
    else rest.push(v);
  });

  const byLang = (arr) => {
    const map = {};
    arr.forEach(v => { (map[v.lang] = map[v.lang] || []).push(v); });
    return Object.entries(map).sort(([a], [b]) => langLabel(a).localeCompare(langLabel(b)));
  };

  const groups = [];
  if (usEn.length) groups.push({ label: "English (US)", voices: usEn });
  byLang(otherEn).forEach(([lang, vs]) => groups.push({ label: langLabel(lang), voices: vs }));
  byLang(rest).forEach(([lang, vs]) => groups.push({ label: langLabel(lang), voices: vs }));
  return groups;
}

export function Terminal({ runCommand, banner, fullrail, chatMode }) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState(banner ? [{ cmd: null, lines: banner }] : []);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [micOn, setMicOn] = useState(false);
  const [micContinuous, setMicContinuous] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null); // null = off
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const recognitionRef = useRef(null);
  const selectedVoiceRef = useRef(null);
  const micOnRef = useRef(false);
  const micContRef = useRef(false);
  const processCmdRef = useRef(null);
  const voiceWrapRef = useRef(null);
  const PROMPT = chatMode ? "persona@chat:~$" : "persona@root:~$";

  const voiceOn = selectedVoice !== null;

  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);

  // Load voices — handles deferred loading on iOS/Safari
  useEffect(() => {
    if (!window.speechSynthesis) return;
    function load() {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    }
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Close dropdown on outside click / touch
  useEffect(() => {
    if (!voiceDropdownOpen) return;
    function onOutside(e) {
      if (voiceWrapRef.current && !voiceWrapRef.current.contains(e.target))
        setVoiceDropdownOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [voiceDropdownOpen]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [history]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  function speakLines(lines) {
    if (!selectedVoiceRef.current || !window.speechSynthesis) return;
    const text = lines
      .map((l) => (typeof l === "string" ? l : l.text || ""))
      .filter(Boolean)
      .join(". ");
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.voice = selectedVoiceRef.current;
    window.speechSynthesis.speak(utt);
  }

  function pushHistory(cmd, lines) {
    setHistory((h) => [...h, { cmd, lines }].slice(-200));
    speakLines(lines);
  }

  function stopMicListening() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setMicOn(false);
    setMicContinuous(false);
    micOnRef.current = false;
    micContRef.current = false;
  }

  function startMicListening(continuous) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    stopMicListening();
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const transcript = event.results[i][0].transcript.trim();
        let cmdText = null;
        if (micContRef.current) {
          cmdText = transcript;
        } else {
          const m = transcript.match(/^[Cc]ommand[,:\s]+(.+)$/i);
          if (m) cmdText = m[1].trim();
        }
        if (cmdText && processCmdRef.current) processCmdRef.current(cmdText, "[mic] " + cmdText);
      }
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      pushHistory(null, [{ kind: "err", text: "mic :: error :: " + e.error }]);
      stopMicListening();
    };
    r.onend = () => { if (micOnRef.current) { try { r.start(); } catch (e) {} } };
    r.start();
    recognitionRef.current = r;
    setMicOn(true);
    setMicContinuous(continuous);
    micOnRef.current = true;
    micContRef.current = continuous;
    return true;
  }

  function processCmd(raw, displayCmd) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const [head, ...rest] = trimmed.split(/\s+/);
    const name = head.toLowerCase();
    let lines;

    if (name === "mic") {
      const sub = (rest[0] || "").toLowerCase();
      const hasCFlag = rest.includes("-c");
      if (sub === "enable" || sub === "on") {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          lines = [{ kind: "err", text: "mic :: SpeechRecognition not supported in this browser" }];
        } else if (startMicListening(hasCFlag)) {
          lines = [{ kind: "acc", text: hasCFlag
            ? "mic :: CONTINUOUS — all speech executed as commands"
            : "mic :: ON — say 'Command <cmd>' to activate" }];
        }
      } else if (sub === "disable" || sub === "off") {
        stopMicListening();
        lines = [{ kind: "acc", text: "mic :: DISABLED" }];
      } else {
        lines = [{ kind: "err", text: "usage: mic <enable|disable> [-c]" }];
      }
    } else if (name === "voice") {
      const sub = (rest[0] || "").toLowerCase();
      if (sub === "enable" || sub === "on") {
        if (!window.speechSynthesis) {
          lines = [{ kind: "err", text: "voice :: SpeechSynthesis not supported in this browser" }];
        } else {
          const v = window.speechSynthesis.getVoices();
          const pick = v[0] || null;
          setSelectedVoice(pick);
          selectedVoiceRef.current = pick;
          lines = [{ kind: "acc", text: "voice :: ENABLED" + (pick ? " — " + pick.name : " — use the VOICE button to pick a voice") }];
        }
      } else if (sub === "disable" || sub === "off") {
        setSelectedVoice(null);
        selectedVoiceRef.current = null;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        lines = [{ kind: "acc", text: "voice :: DISABLED" }];
      } else {
        lines = [{ kind: "err", text: "usage: voice <enable|disable>" }];
      }
    } else {
      const result = runCommand(trimmed);
      if (result === "__clear__") { setHistory([]); return; }
      if (result && typeof result.then === "function") {
        const displayKey = displayCmd !== undefined ? displayCmd : trimmed;
        setHistory((h) => [...h, { cmd: displayKey, lines: [{ kind: "dim", text: "> locating..." }] }].slice(-200));
        result.then((asyncResult) => {
          const normalized = (Array.isArray(asyncResult) ? asyncResult : [asyncResult == null ? { kind: "out", text: "" } : asyncResult])
            .map((x) => (typeof x === "string" ? { kind: "out", text: x } : x));
          setHistory((h) => {
            if (h.length === 0) return h;
            const copy = [...h];
            copy[copy.length - 1] = { ...copy[copy.length - 1], lines: normalized };
            return copy;
          });
          speakLines(normalized);
        }).catch(() => {
          setHistory((h) => {
            if (h.length === 0) return h;
            const copy = [...h];
            copy[copy.length - 1] = { ...copy[copy.length - 1], lines: [{ kind: "err", text: "> request failed" }] };
            return copy;
          });
        });
        return;
      }
      lines = Array.isArray(result)
        ? result.map((x) => (typeof x === "string" ? { kind: "out", text: x } : x))
        : result == null ? []
        : [{ kind: "out", text: String(result) }];
    }

    if (lines) pushHistory(displayCmd !== undefined ? displayCmd : trimmed, lines);
  }

  processCmdRef.current = processCmd;

  const submit = (e) => {
    e.preventDefault();
    const cmd = value;
    if (!cmd.trim()) return;
    processCmd(cmd);
    setCmdHistory((h) => (h[h.length - 1] === cmd ? h : [...h, cmd]).slice(-100));
    setHistIdx(-1);
    setValue("");
  };

  const onKey = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const i = histIdx === -1 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setValue(cmdHistory[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const i = histIdx + 1;
      if (i >= cmdHistory.length) { setHistIdx(-1); setValue(""); }
      else { setHistIdx(i); setValue(cmdHistory[i]); }
    }
  };

  return html`
    <div className=${"terminal" + (fullrail ? " fullrail" : "") + (history.length === 0 ? " collapsed" : "")}
         onClick=${() => inputRef.current && inputRef.current.focus()}>
      ${(fullrail || history.length > 0) && html`
        <div className="term-body" ref=${bodyRef}>
          ${history.length === 0 && fullrail
            ? html`<div className="term-out dim">// type 'help' to see what this shell can do.</div>`
            : history.map((h, i) => html`
              <div key=${i} className="term-entry">
                ${h.cmd != null && html`
                  <div className="term-cmd"><span className="term-pfx">${PROMPT}</span> ${h.cmd}</div>
                `}
                ${h.lines.map((l, j) => {
                  if (l && typeof l === "object" && l.kind === "cmd-row") {
                    return html`
                      <div key=${j} className="term-row">
                        <span className="term-row-cmd">${l.cmd}</span>
                        <span className="term-row-desc">${l.desc}</span>
                      </div>
                    `;
                  }
                  const text = typeof l === "string" ? l : l.text;
                  const kind = typeof l === "string" ? "out" : (l.kind || "out");
                  return html`<div key=${j} className=${"term-out " + (kind === "out" ? "" : kind)}>${text}</div>`;
                })}
              </div>
            `)
          }
        </div>
      `}
      <div className="term-toolbar" onClick=${(e) => e.stopPropagation()}>
        <button
          className=${"term-tool-btn" + (micOn ? (micContinuous ? " active continuous" : " active") : "")}
          onClick=${() => micOn ? stopMicListening() : startMicListening(false)}
          title=${micOn
            ? (micContinuous ? "Mic: continuous mode (click to disable)" : "Mic: say 'Command ...' (click to disable)")
            : "Enable microphone (keyword mode)"}
        >
          ${micOn && html`<span className="term-mic-dot" />`}
          MIC: ${micOn ? (micContinuous ? "LIVE" : "ON") : "OFF"}
        </button>
        <div className="term-voice-wrap" ref=${voiceWrapRef}>
          <button
            className=${"term-tool-btn" + (voiceOn ? " active" : "")}
            onClick=${() => setVoiceDropdownOpen((o) => !o)}
            title="Select voice output"
          >
            VOICE: ${voiceOn ? selectedVoice.name.split(/[\s(]/)[0] : "OFF"} ▾
          </button>
          ${voiceDropdownOpen && html`
            <div className="voice-dropdown">
              <div
                className=${"voice-option" + (!voiceOn ? " selected" : "")}
                onMouseDown=${(e) => { e.preventDefault(); setSelectedVoice(null); selectedVoiceRef.current = null; if (window.speechSynthesis) window.speechSynthesis.cancel(); setVoiceDropdownOpen(false); }}
              >Off</div>
              ${voices.length === 0
                ? html`<div className="voice-option dim">loading voices…</div>`
                : groupVoices(voices).map(({ label, voices: gVoices }, gi) => html`
                  <div key=${label}>
                    <div className=${"voice-group-label" + (gi === 0 ? " first" : "")}>${label}</div>
                    ${gVoices.map((v, i) => html`
                      <div
                        key=${i}
                        className=${"voice-option" + (selectedVoice === v ? " selected" : "")}
                        onMouseDown=${(e) => { e.preventDefault(); setSelectedVoice(v); selectedVoiceRef.current = v; setVoiceDropdownOpen(false); }}
                      >${v.name}</div>
                    `)}
                  </div>
                `)
              }
            </div>
          `}
        </div>
      </div>
      <form className="term-input-row" onSubmit=${submit}>
        <span className="term-pfx">${PROMPT}</span>
        ${!value && html`<span className="term-cursor">▌</span>`}
        <input
          ref=${inputRef}
          className="term-input"
          value=${value}
          onChange=${(e) => setValue(e.target.value)}
          onKeyDown=${onKey}
          autoComplete="off"
          spellCheck=${false}
          placeholder=${chatMode ? "ask a question…" : "try 'help'"}
        />
      </form>
    </div>
  `;
}
