import React from "../lib/react.js";
import { Button } from "./ui.js";
function ThemeIcon({ dark }) {
  return <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
    focusable="false"
  >
    {dark ? <path d="M20.6 13.2A8.5 8.5 0 0 1 10.8 3.4 8.5 8.5 0 1 0 20.6 13.2Z" /> :
      <React.Fragment>
        <circle
          cx="12"
          cy="12"
          r="4"
        />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </React.Fragment>}
  </svg>;
}
function ThemeSwitcher({ theme, onChange }) {
  return <div
    className="theme-switch"
    role="group"
    aria-label="Color theme"
  >
    {["light", "dark"].map((value) => <Button
      key={value}
      className="btn small theme-option"
      aria-label={"Use " + value + " mode"}
      aria-pressed={theme === value}
      onClick={() => onChange(value)}
    >
      <ThemeIcon dark={value === "dark"} />
      {value === "light" ? "Light" : "Dark"}
    </Button>)}
  </div>;
}
export { ThemeSwitcher };
