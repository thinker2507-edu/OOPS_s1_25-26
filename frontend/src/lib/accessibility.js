const PREFERENCE_KEY = "relay-access";
const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system",
  contrast: false,
  large: false,
  motion: false,
  readableSpacing: false,
  underlineLinks: false,
  largeTargets: false,
  strongFocus: false
});
function normalizePreferences(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const preferences = { ...DEFAULT_PREFERENCES };
  preferences.theme = ["system", "light", "dark"].includes(input.theme) ? input.theme : "system";
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    if (key !== "theme") {
      preferences[key] = input[key] === true;
    }
  }
  return preferences;
}
function parsePreferences(serialized) {
  try {
    return normalizePreferences(JSON.parse(serialized || "{}"));
  }
  catch {
    return normalizePreferences({});
  }
}
function readPreferences(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return parsePreferences(target?.getItem(PREFERENCE_KEY));
  }
  catch {
    return normalizePreferences({});
  }
}
function savePreferences(preferences, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const serialized = JSON.stringify(normalizePreferences(preferences));
    if (target?.getItem(PREFERENCE_KEY) !== serialized) {
      target?.setItem(PREFERENCE_KEY, serialized);
    }
    return Boolean(target);
  }
  catch {
    return false;
  }
}
function systemPreferences(match = globalThis.matchMedia?.bind(globalThis)) {
  return {
    dark: Boolean(match?.("(prefers-color-scheme: dark)")?.matches),
    motion: Boolean(match?.("(prefers-reduced-motion: reduce)")?.matches)
  };
}
function resolveTheme(choice, dark = false) {
  return choice === "dark" || choice !== "light" && dark ? "dark" : "light";
}
function applyPreferences(document, value, system = systemPreferences()) {
  const preferences = normalizePreferences(value);
  const root = document.documentElement;
  const theme = resolveTheme(preferences.theme, system.dark);
  root.dataset.theme = theme;
  root.dataset.themeChoice = preferences.theme;
  const classes = {
    contrast: preferences.contrast,
    "large-text": preferences.large,
    "reduce-motion": preferences.motion || system.motion,
    "readable-spacing": preferences.readableSpacing,
    "underline-links": preferences.underlineLinks,
    "large-targets": preferences.largeTargets,
    "strong-focus": preferences.strongFocus
  };
  for (const [name, enabled] of Object.entries(classes))
    root.classList.toggle(name, enabled);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#17131f" : "#624CAB");
  return theme;
}
export { PREFERENCE_KEY, DEFAULT_PREFERENCES, normalizePreferences, parsePreferences, readPreferences, savePreferences, systemPreferences, resolveTheme, applyPreferences, };
