import React from "../../lib/react.js";
import { Link } from "../../app/navigation.js";
import { GROUPS, EMPLOYEE_GROUPS, TECHNICIAN_GROUPS } from "../../app/navigation-config.js";
import { Button } from "../ui.js";
import { initials, pretty } from "../../lib/format.js";
export function Sidebar({
  data,
  menu,
  setMenu,
  group,
  path,
  unread,
  signOut
}) {
  const employee = data.user.role === 'employee';
  const personal = employee || data.user.role === 'technician';
  const groups = employee ? EMPLOYEE_GROUPS : data.user.role === 'technician' ? TECHNICIAN_GROUPS : GROUPS;
  const pending = data.support_requests.filter(r => r.status === 'pending' && r.incident_status !== 'CLOSED').length;
  return <aside className="sidebar">
    <Link
      to="/overview"
      className="brand"
    >
      <span className="brand-mark">
        r
      </span>
      <span>
        relay
        <small>
          IT SERVICE WORKSPACE
        </small>
      </span>
    </Link>
    <Button
      className="btn mobile-menu"
      aria-expanded={menu}
      aria-controls="workspace-navigation"
      onClick={() => setMenu(!menu)}
    >
      {menu ? 'Close menu' : 'Menu'}
    </Button>
    <nav
      id="workspace-navigation"
      className={'section-nav' + (menu ? ' expanded' : '')}
      aria-label="Main navigation"
    >
      {groups.filter(g => !g.admin || data.user.role === 'admin').map(g => {
        const selected = group === g;
        return <div
          key={g.label}
          className={'nav-group' + (selected ? ' current' : '')}
        >
          <Link
            to={g.to}
            className="nav-parent"
            aria-current={path === g.to ? 'page' : undefined}
          >
            <span aria-hidden>
              {g.icon}
            </span>
            {g.label}
            {employee && g.to === '/incidents/mine' && pending > 0 && <span
              className="count"
              aria-label={pending + ' requests awaiting response'}
            >
              {pending}
            </span>}
            {g.label === 'Notifications' && unread > 0 && <span className="count">
              {unread}
            </span>}
          </Link>
          {selected && g.children && <div className="sub-navigation">
            {g.children.filter(([, , admin]) => !admin || data.user.role === 'admin').map(([label, to]) => <Link
              key={to}
              to={to}
              aria-current={path === to ? 'page' : undefined}
            >
              {label}
            </Link>)}
          </div>}
        </div>;
      })}
    </nav>
    <div className="sidebar-bottom">
      <div className="user">
        <span
          className="avatar"
          aria-hidden
        >
          {initials(data.user.name)}
        </span>
        <div>
          {personal ? <Link
            to="/settings/account"
            aria-label="Profile and Google account"
          >
            <strong>
              {data.user.name}
            </strong>
          </Link> : <strong>
            {data.user.name}
          </strong>}
          <small>
            {pretty(data.user.role)}
          </small>
        </div>
        <button
          className={personal ? 'account-logout' : undefined}
          aria-label="Sign out"
          title="Sign out"
          onClick={signOut}
        >
          ↗
        </button>
      </div>
    </div>
  </aside>;
}
