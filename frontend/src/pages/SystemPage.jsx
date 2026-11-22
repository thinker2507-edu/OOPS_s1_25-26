import React, { useState, useEffect } from "../lib/react.js";
import { api } from "../services/api.js";
import { Card, ErrorBox, Button } from "../components/ui.js";
import { Link } from '../app/navigation.js';
import { StorageUsage } from '../components/admin/CloudControls.js';
function SystemPage({ onStop }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('system').then(setInfo).catch(e => setError(e.message));
  }, []);
  return <><Card title="Server information">
    <p>
      <Link to="/settings/api">
        Open REST API explorer
      </Link>
    </p>
    <ErrorBox message={error} />
    {info && <React.Fragment>
      <p>
        {'Backend: ' + info.backend}
      </p>
      <p>
        {'Database: ' + (info.database === 'mongodb' ? 'MongoDB' : info.database)}
      </p>
      <p>
        {'HTTP port: ' + info.port}
      </p>
      <p>
        {'Uptime: ' + info.uptime + ' seconds'}
      </p>
      {info.can_stop && <><p className="description">
        Stop this Relay instance to release its HTTP port. Your saved database records are retained.
      </p>
      <Button
        primary
        disabled={busy || !info.can_stop}
        onClick={async () => {
          setBusy(true);
          try {
            await api('system/stop', {});
            onStop();
          }
          catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Stopping…' : 'Stop server'}
      </Button>
      <p className="help">
        For Docker, also run docker compose down to stop the database container.
      </p></>}
      {!info.can_stop && <p className="help">Cloud hosting manages this server. Background SLA detection and email delivery resume when the service wakes.</p>}
    </React.Fragment>}
  </Card><StorageUsage /></>;
}
export { SystemPage };
