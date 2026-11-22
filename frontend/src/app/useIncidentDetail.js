import { useEffect, useRef, useState } from '../lib/react.js';
import { api } from '../services/api.js';
import { IncidentSync } from '../lib/incident-sync.js';
export function useIncidentDetail({ id, userId, version, stopped }) {
  const scope = id && userId ? userId + ':' + id : null;
  const [state, setState] = useState({
    scope: null,
    incident: null,
    error: ''
  });
  const reader = useRef(null);
  useEffect(() => {
    if (!scope || stopped) {
      return;
    }
    setState({
      scope,
      incident: null,
      error: ''
    });
    const sync = new IncidentSync({
      load: signal => api('incidents/' + id, undefined, { signal }),
      onUpdate: incident => setState({
        scope,
        incident,
        error: ''
      }),
      onError: error => setState(current => ({
        scope,
        incident: [401, 403, 404].includes(error.status) ? null : current.scope === scope ? current.incident : null,
        error: error.message
      }))
    });
    reader.current = {
      scope,
      sync
    };
    const refreshVisible = () => {
      if (!document.hidden) {
        sync.refresh();
      }
    };
    sync.refresh();
    const timer = setInterval(refreshVisible, 5000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      sync.dispose();
      if (reader.current?.sync === sync) {
        reader.current = null;
      }
    };
  }, [scope, stopped]);
  useEffect(() => {
    if (reader.current?.scope === scope) {
      reader.current.sync.refresh();
    }
  }, [scope, version]);
  async function mutate(values) {
    const current = reader.current;
    if (current?.scope !== scope) {
      throw new Error('Wait for the incident to load, then try again.');
    }
    return current.sync.mutate(() => api('incidents/' + id, values));
  }
  return {
    detail: state.scope === scope ? state.incident : null,
    detailError: state.scope === scope ? state.error : '',
    mutate,
    refreshDetail: () => reader.current?.scope === scope ? reader.current.sync.refresh() : Promise.resolve()
  };
}
