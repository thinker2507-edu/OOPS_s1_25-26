import { useState, useEffect } from "../lib/react.js";
import { PREFERENCE_KEY, normalizePreferences, parsePreferences, readPreferences, savePreferences, systemPreferences, resolveTheme, applyPreferences, } from "../lib/accessibility.js";
function useAccessibility() {
  const [options, setOptions] = useState(readPreferences);
  const [system, setSystem] = useState(systemPreferences);
  useEffect(() => {
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSystem = () => setSystem(systemPreferences());
    const synchronize = (event) => {
      if (event.key === PREFERENCE_KEY) {
        setOptions(parsePreferences(event.newValue));
      }
      else if (event.key === null) {
        setOptions(readPreferences());
      }
    };
    theme.addEventListener("change", updateSystem);
    motion.addEventListener("change", updateSystem);
    window.addEventListener("storage", synchronize);
    updateSystem();
    return () => {
      theme.removeEventListener("change", updateSystem);
      motion.removeEventListener("change", updateSystem);
      window.removeEventListener("storage", synchronize);
    };
  }, []);
  useEffect(() => {
    applyPreferences(document, options, system);
    savePreferences(options);
  }, [options, system]);
  return {
    options,
    setOptions: (next) => setOptions((previous) => normalizePreferences(typeof next === "function" ? next(previous) : next)),
    theme: resolveTheme(options.theme, system.dark),
    setTheme: (theme) => setOptions((previous) => normalizePreferences({
      ...previous,
      theme
    }))
  };
}
export { useAccessibility };
