import React from "../../lib/react.js";
import { Link } from "../../app/navigation.js";
import { Button } from "../ui.js";
import { incId } from "../../lib/format.js";
import { ThemeSwitcher } from "../ThemeSwitcher.js";
export function Header({
  group,
  title,
  id,
  onRefresh,
  theme,
  onThemeChange
}) {
  return <header className="topbar">
    <nav
      aria-label="Breadcrumb"
      className="breadcrumbs"
    >
      <Link to="/overview">
        Workspace
      </Link>
      <span aria-hidden>
        /
      </span>
      {group && <Link to={group.to}>
        {group.label}
      </Link>}
      {id && <span>
        {' / ' + incId(id)}
      </span>}
      {!id && group && title !== group.label && <span>
        {' / ' + title}
      </span>}
    </nav>
    <div className="topbar-actions">
      <ThemeSwitcher
        theme={theme}
        onChange={onThemeChange}
      />
      <Link
        to="/settings/accessibility"
        className="btn small"
      >
        Accessibility
      </Link>
      <Button
        className="btn small"
        aria-label="Refresh workspace"
        onClick={onRefresh}
      >
        ↻
      </Button>
    </div>
  </header>;
}
