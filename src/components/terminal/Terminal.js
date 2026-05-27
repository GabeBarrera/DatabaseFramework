import { useState, useEffect, useRef } from "react";
import { html } from "htm/react";

export function Terminal({ runCommand, banner, fullrail, chatMode }) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState(banner ? [{ cmd: null, lines: banner }] : []);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [micOn, setMicOn] = useState(false);
  const [micContinuous, setMicContinuous] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceOnRef = useRef(false);
  const micOnRef = useRef(false);
  const micContRef = useRef(false);
  const processCmdRef = useRef(null);
  const PROMPT = chatMode ? "persona@chat:~$" : "persona@root:~$";

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);

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
    if (!voiceOnRef.current || !window.speechSynthesis) return;
    const text = lines
      .map((l) => (typeof l === "string" ? l : l.text || ""))
      .filter(Boolean)
      .join(". ");
    if (!text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
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
      if (e.error !== "no-speech" && e.error !== "aborted")
        pushHistory(null, [{ kind: "err", text: "mic :: error :: " + e.error }]);
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
        setVoiceOn(true);
        voiceOnRef.current = true;
        lines = [{ kind: "acc", text: "voice :: ENABLED — results will be read aloud" }];
      } else if (sub === "disable" || sub === "off") {
        setVoiceOn(false);
        voiceOnRef.current = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        lines = [{ kind: "acc", text: "voice :: DISABLED" }];
      } else {
        lines = [{ kind: "err", text: "usage: voice <enable|disable>" }];
      }
    } else {
      const result = runCommand(trimmed);
      if (result === "__clear__") { setHistory([]); return; }
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
        <button
          className=${"term-tool-btn" + (voiceOn ? " active" : "")}
          onClick=${() => {
            if (voiceOn) {
              setVoiceOn(false);
              voiceOnRef.current = false;
              if (window.speechSynthesis) window.speechSynthesis.cancel();
            } else {
              setVoiceOn(true);
              voiceOnRef.current = true;
            }
          }}
          title=${voiceOn ? "Voice output: ON (click to disable)" : "Enable voice output"}
        >
          VOICE: ${voiceOn ? "ON" : "OFF"}
        </button>
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
