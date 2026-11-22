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
  unread = 0,
  notifications,
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
      <Link to="/notifications/inbox" className="btn small notification-bell" aria-label={'Notifications: ' + unread + ' unread'}>
        Notifications{unread > 0 && <span className="count">{unread}</span>}
      </Link>
      {notifications?.permission === 'default' && <Button className="btn small" onClick={notifications.enable}>Enable alerts</Button>}
      <span className="sr-only notification-live-status" role="status">{notifications?.connection === 'live' ? 'Live notifications connected' : 'Live notifications reconnecting'}</span>
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
