import { Sidebar } from "../components/layout/Sidebar.js";
import { Header } from "../components/layout/Header.js";
import { NewIncidentPage } from "../pages/NewIncidentPage.js";
import React, { useState, useEffect, useRef } from "../lib/react.js";
import { api, setCsrfToken } from "../services/api.js";
import { useRoute, Link, NavContext } from "./navigation.js";
import { Card, ErrorBox } from "../components/ui.js";
import { Accessibility } from "../components/Accessibility.js";
import { Login } from "../pages/Login.js";
import { GROUPS, EMPLOYEE_GROUPS, TECHNICIAN_GROUPS, TITLES } from "./navigation-config.js";
import { TechnicianDashboard, TechnicianWorkload } from '../pages/technician/Workspace.js';
import { AdminMonitorPage } from '../pages/AdminMonitorPage.js';
import { EmployeeDashboard } from '../pages/employee/Dashboard.js';
import { ReportIncident } from '../pages/employee/ReportIncident.js';
import { MyIncidents } from '../pages/employee/MyIncidents.js';
import { SupportRequests } from '../pages/employee/SupportRequests.js';
import { EmployeeIncidentDetail } from '../pages/employee/IncidentDetail.js';
import { incId } from "../lib/format.js";
import { FINISHED_UI } from "../lib/incidents.js";
import { IncidentWorkspace } from "../pages/IncidentWorkspace.js";
import { IncidentTable } from "../components/incidents/IncidentTable.js";
import { OverviewPage } from "../pages/OverviewPage.js";
import { ReportsPage } from "../pages/ReportsPage.js";
import { Administration } from "../pages/Administration.js";
import { NotificationsPage } from "../pages/NotificationsPage.js";
import { AccountPage } from "../pages/AccountPage.js";
import { SystemPage } from "../pages/SystemPage.js";
import { ApiExplorerPage } from '../pages/ApiExplorerPage.js';
import { PasswordRecoveryPage } from '../pages/PasswordRecoveryPage.js';
import { useAccessibility } from "./useAccessibility.js";
import { ThemeSwitcher } from "../components/ThemeSwitcher.js";
import { useIncidentDetail } from './useIncidentDetail.js';
import { useLiveNotifications } from './useLiveNotifications.js';
function App() {
  const [raw, navigate] = useRoute();
  const path = ({
    '/': '/overview',
    '/admin': '/admin/users',
    '/reports': '/reports/overview',
    '/notifications': '/notifications/inbox',
    '/settings': '/settings/account'
  })[raw] || raw;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [filters, setFilters] = useState({});
  const [menu, setMenu] = useState(false);
  const [stopped, setStopped] = useState(false);
  const refreshFlight = useRef(null);
  const refreshGeneration = useRef(0);
  const notificationRevision = useRef(0);
  const toastTimer = useRef(null);
  const { options, setOptions, theme, setTheme } = useAccessibility();
  const requested = useRef(![
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ].includes(raw) ? raw : '/overview');
  const match = path.match(/^\/incidents\/(\d+)(?:\/(conversation|resolution|activity))?$/);
  const id = match ? Number(match[1]) : null;
  const tab = match?.[2] || 'overview';
  const { detail, detailError, mutate, refreshDetail } = useIncidentDetail({
    id,
    userId: data?.user.id,
    stopped,
    version: data?.incidents.find(incident => incident.id === id)?.updated_at
  });
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const liveNotifications = useLiveNotifications({
    user: stopped ? null : data?.user,
    notifications: data?.notifications,
    onUpdate: notifications => { notificationRevision.current++; setData(current => current ? { ...current, notifications } : current); },
    onAlert: alert => { notify(alert.message); if (!alert.initial && alert.incidentId === id) refreshDetail(); },
    onExpired: () => refresh(true).catch(() => {})
  });
  async function refresh(required = false) {
    if (!required && refreshFlight.current) return refreshFlight.current;
    const generation = ++refreshGeneration.current;
    const revision = notificationRevision.current;
    const request = (async () => {
      try {
        const next = await api('bootstrap');
        if (generation !== refreshGeneration.current) return next;
        setCsrfToken(next.csrf);
        setData(current => ({ ...next, notifications: revision !== notificationRevision.current && current?.user.id === next.user.id ? current.notifications : next.notifications }));
        setError('');
        return next;
      }
      catch (e) {
        if (generation !== refreshGeneration.current) return;
        if (e.status === 401) {
          setData(null);
        }
        else {
          setError(e.message);
        }
        if (required) {
          throw e;
        }
      }
      finally {
        if (generation === refreshGeneration.current) setLoading(false);
      }
    })();
    refreshFlight.current = request;
    try { return await request; }
    finally { if (refreshFlight.current === request) refreshFlight.current = null; }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (stopped || !data) {
      return;
    }
    const timer = setInterval(() => {
      if (!document.hidden) {
        refresh();
      }
    }, 30000);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [stopped, data?.user.id]);
  useEffect(() => {
    if (!loading && !stopped) {
      if (!data && ![
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/settings/accessibility'
      ].includes(path)) {
        navigate('/login', true);
      }
      else if (data && ['/login', '/register'].includes(path)) {
        navigate(data.user.role === 'employee' ? '/incidents/mine' : '/overview', true);
      }
      else if (data?.user.role === 'employee' && path === '/overview') {
        navigate('/incidents/mine', true);
      }
      else if (raw !== path) {
        navigate(path, true);
      }
    }
  }, [
    loading,
    Boolean(data),
    raw,
    path,
    stopped
  ]);
  useEffect(() => {
    setMenu(false);
    setFilters({});
    requestAnimationFrame(() => document.querySelector('main h1')?.focus());
  }, [path]);
  async function action(values) {
    await mutate(values);
    await refresh();
    notify(values.action === 'information' ? 'Additional information saved' : 'Incident updated');
  }
  async function save(values) {
    await api('admin', values);
    await refresh(true);
    notify('Configuration saved');
  }
  async function signOut() {
    try {
      await api('logout', {});
      refreshGeneration.current++;
      refreshFlight.current = null;
      setCsrfToken('');
      setToast('');
      setError('');
      setData(null);
      requested.current = '/overview';
      navigate('/login');
    }
    catch (e) {
      notify(e.message);
    }
  }
  let content;
  if (stopped) {
    content = <main
      id="main"
      className="stopped-page"
    >

      <div className="brand">

        relay
      </div>

      <h1 tabIndex={-1}>

        Relay has stopped
      </h1>

      <p>

        Your records have been saved.
      </p>

      <p>

        Please contact your administrator if you need to restore access.
      </p>

    </main>;
  }
  else if (loading) {
    content = <main
      id="main"
      className="loading-page"
      role="status"
    >

      Connecting to your service workspace…
    </main>;
  }
  else if (['/forgot-password', '/reset-password'].includes(path)) {
    content = <PasswordRecoveryPage
      key={path}
      reset={path === '/reset-password'}
      theme={theme}
      onThemeChange={setTheme}
    />;
  }
  else if (!data && path === '/settings/accessibility') {
    content = <main
      id="main"
      className="public-page"
    >

      <div className="public-theme">
        <ThemeSwitcher
          theme={theme}
          onChange={setTheme}
        />
      </div>

      <Link
        to="/login"
        className="back-link"
      >

        ← Back to sign in
      </Link>

      <h1 tabIndex={-1}>

        Accessibility preferences
      </h1>

      <Card title="Make Relay work for you">

        <Accessibility
          options={options}
          setOptions={setOptions}
          resolvedTheme={theme}
        />

      </Card>

    </main>;
  }
  else if (!data) {
    content = <Login
      theme={theme}
      onThemeChange={setTheme}
      register={path === '/register'}
      access={() => navigate('/settings/accessibility')}
      onLogin={async () => {
        const next = await refresh(true);
        navigate(next.user.role === 'employee' ? '/incidents/mine' : requested.current.startsWith('/admin') && next.user.role !== 'admin' ? '/overview' : requested.current);
      }}
    />;
  }
  else {
    const employee = data.user.role === 'employee';
    const technician = data.user.role === 'technician';
    const personalGroups = employee ? EMPLOYEE_GROUPS : TECHNICIAN_GROUPS;
    const group = employee || technician ? personalGroups.find(g => g.to === path || g.to === '/incidents/mine' && (id || ['/incidents', '/support-requests'].includes(path))) : GROUPS.find(g => g.to.split('/')[1] === path.split('/')[1]);
    const title = id ? (detail?.title || incId(id)) : technician && path === '/overview' ? 'Support desk' : technician && path === '/incidents/mine' ? 'Assigned incidents' : technician && path === '/reports/workload' ? 'My workload' : employee && path === '/overview' ? 'Dashboard' : employee && path === '/settings/account' ? 'Profile' : TITLES[path] || 'Page not found';
    const active = data.incidents.filter(i => !FINISHED_UI.includes(i.status));
    const unread = data.notifications.filter(n => !n.is_read && n.channel === 'in_app').length;
    const restricted = (path.startsWith('/admin') || ['/settings/system', '/settings/api', '/reports/audit', '/reports/sla'].includes(path)) && data.user.role !== 'admin';
    function filteredRows() {
      let rows = data.incidents;
      if (path === '/incidents/mine' && data.user.role !== 'employee') {
        rows = rows.filter(i => i.technician_id === data.user.id);
      }
      return rows.filter(i => Object.entries(filters).every(([key, value]) => !value || key === 'q' || (key === 'from' ? new Date(i.created_at * 1000) >= new Date(value + 'T00:00:00') : String(i[key]) === value)));
    }
    function exportCsv(rows = filteredRows()) {
      const cols = [
        'id',
        'title',
        'priority',
        'status',
        'category',
        'service',
        'technician',
        'sla_status',
        'resolution'
      ];
      const cell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
      const csv = '\ufeff' + [cols.join(','), ...rows.map(i => cols.map(c => cell(c === 'id' ? incId(i.id) : i[c])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relay-incidents.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    let body;
    if (restricted) {
      body = <ErrorBox message="This page is available to administrators." />;
    }
    else if (id) {
      const ownReport = employee || technician && detail?.reporter_id === data.user.id && detail?.technician_id !== data.user.id;
      const Workspace = ownReport ? EmployeeIncidentDetail : IncidentWorkspace;
      body = detail ? <Workspace
        incident={detail}
        data={data}
        onAction={action}
        section={tab}
        onDelete={async confirmation => {
          await api('incidents/' + id, { confirmation }, { method: 'DELETE' });
          navigate('/incidents');
          await refresh(true);
          notify('Incident permanently deleted');
        }}
      /> : detailError ? <ErrorBox message={detailError} /> : <p role="status">

        Loading incident…
      </p>;
    }
    else if (path === '/incidents/new') {
      const ReportPage = employee || technician ? ReportIncident : NewIncidentPage;
      body = <ReportPage
        data={data}
        onCreate={async (values) => {
          const i = await api('incidents', values);
          await refresh(true);
          if (!employee && !technician) {
            navigate('/incidents/' + i.id);
          }
          notify(incId(i.id) + ' submitted');
          return i;
        }}
      />;
    }
    else if (path === '/incidents/reported' && technician) {
      body = <MyIncidents data={{ ...data, incidents: data.incidents.filter(i => i.reporter_id === data.user.id) }} />;
    }
    else if (path === '/incidents' || path === '/incidents/mine') {
      body = employee ? <MyIncidents data={data} /> : <IncidentTable
        rows={filteredRows()}
        data={data}
        open={rid => navigate('/incidents/' + rid)}
        filters={filters}
        setFilters={setFilters}
        exportCsv={exportCsv}
      />;
    }
    else if (path === '/overview') {
      const Dashboard = employee ? EmployeeDashboard : technician ? TechnicianDashboard : OverviewPage;
      body = <Dashboard
        data={data}
        active={active}
      />;
    }
    else if (path === '/support-requests') {
      body = <SupportRequests data={data} />;
    }
    else if (path.startsWith('/reports/')) {
      body = ['audit', 'sla'].includes(path.split('/')[2]) ? <AdminMonitorPage
        key={path}
        kind={path.split('/')[2]}
      /> : technician && path === '/reports/workload' ? <TechnicianWorkload data={data} /> : <ReportsPage
        data={data}
        section={path.split('/')[2]}
      />;
    }
    else if (path.startsWith('/admin/')) {
      body = <Administration
        data={data}
        save={save}
        section={path.split('/')[2]}
      />;
    }
    else if (path.startsWith('/notifications/')) {
      body = <NotificationsPage
        data={data}
        refresh={refresh}
        path={path}
        browserNotifications={liveNotifications}
      />;
    }
    else if (path === '/settings/account') {
      body = <AccountPage
        data={data}
        signOut={signOut}
      />;
    }
    else if (path === '/settings/accessibility') {
      body = <Card title="Make Relay work for you">

        <Accessibility
          options={options}
          setOptions={setOptions}
          resolvedTheme={theme}
        />

      </Card>;
    }
    else if (path === '/settings/system') {
      body = <SystemPage onStop={() => setStopped(true)} />;
    }
    else if (path === '/settings/api') {
      body = <ApiExplorerPage />;
    }
    else {
      body = <p>

        {'This page does not exist. '}

        <Link to="/overview">

          Return to overview
        </Link>

      </p>;
    }
    content = <div className="shell">

      <Sidebar
        data={data}
        menu={menu}
        setMenu={setMenu}
        group={group}
        path={path}
        unread={unread}
        signOut={signOut}
      />

      <div className="content">

        <Header
          unread={unread}
          notifications={liveNotifications}
          theme={theme}
          onThemeChange={setTheme}
          group={group}
          title={title}
          id={id}
          onRefresh={async () => {
            await refresh();
            if (id) {
              await refreshDetail();
            }
          }}
        />

        <main
          id="main"
          className="main"
          tabIndex={-1}
        >

          {error && <ErrorBox message={error} />}
          {detail && detailError && <ErrorBox message={'Could not refresh this incident: ' + detailError} />}

          {id && <Link
            to={employee ? '/incidents/mine' : '/incidents'}
            className="back-link"
          >

            ← Back to incidents
          </Link>}

          <div className="page-heading">

            <div>

              <div className="eyebrow">

                {id ? incId(id) : group?.label || 'YOUR WORKSPACE'}

              </div>

              <h1 tabIndex={-1}>

                {title}

              </h1>

              <p>

                {path === '/overview' ? 'Hello, ' + data.user.name.split(' ')[0] + '. Here is what needs your attention.' : id ? 'Track the next step and keep the full history together.' : 'Keep the next step clear and the work moving.'}

              </p>

            </div>

            {data.user.role === 'admin' && !id && path !== '/incidents/new' && <Link
              to="/incidents/new"
              className="btn primary"
            >

              + New incident
            </Link>}

          </div>

          {body}

        </main>

      </div>

    </div>;
  }
  return <NavContext.Provider value={navigate}>

    {content}

    <div
      id="toast"
      role="status"
      aria-live="polite"
    >

      {toast}

    </div>

  </NavContext.Provider>;
}
export { App };
