import { useState, useRef, useCallback, useEffect } from "react";
import { LS_FOLDER_KEY } from "../lib/storage.js";

export function useImageDir() {
  const [dirName, setDirNameState] = useState(() => localStorage.getItem(LS_FOLDER_KEY) || null);
  const [map, setMap] = useState({});
  const objectUrlsRef = useRef([]);

  const setDirName = useCallback((name) => {
    setDirNameState(name);
    try {
      if (name != null) localStorage.setItem(LS_FOLDER_KEY, name);
      else localStorage.removeItem(LS_FOLDER_KEY);
    } catch (e) {}
  }, []);

  const cleanup = () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
  };

  const ingestFiles = useCallback((files) => {
    cleanup();
    const m = {};
    Array.from(files).forEach((f) => {
      if (!f.type || !f.type.startsWith("image/")) return;
      const url = URL.createObjectURL(f);
      objectUrlsRef.current.push(url);
      const key = (f.name || "").toLowerCase();
      m[key] = url;
      const stem = key.replace(/\.[^.]+$/, "");
      if (stem && !m[stem]) m[stem] = url;
    });
    setMap(m);
  }, []);

  const pickDirectory = useCallback(async () => {
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        setDirName(handle.name);
        const collected = [];
        for await (const entry of handle.values()) {
          if (entry.kind === "file") {
            try { collected.push(await entry.getFile()); } catch (e) {}
          }
        }
        ingestFiles(collected);
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.webkitdirectory = true;
      input.directory = true;
      input.accept = "image/*";
      input.onchange = () => {
        if (input.files && input.files.length) {
          const first = input.files[0];
          const folder = (first.webkitRelativePath || "").split("/")[0] || "Local Folder";
          setDirName(folder);
          ingestFiles(input.files);
          resolve(true);
        } else {
          resolve(false);
        }
      };
      input.click();
    });
  }, [ingestFiles, setDirName]);

  const resolve = useCallback((imageRef) => {
    if (!imageRef) return null;
    if (/^(data:|blob:|https?:)/i.test(imageRef)) return imageRef;
    const lower = imageRef.toLowerCase();
    if (map[lower]) return map[lower];
    const stem = lower.replace(/\.[^.]+$/, "");
    if (map[stem]) return map[stem];
    return null;
  }, [map]);

  useEffect(() => () => cleanup(), []);

  return { dirName, setDirName, pickDirectory, resolve, hasMap: Object.keys(map).length > 0 };
}
