import React, { useState, useEffect } from '../../lib/react.js';
import { api } from '../../services/api.js';
import { Card, Form, Field, ErrorBox } from '../ui.js';
export function AssignmentEditor({ data, save }) {
  return <Card title="Automatic assignment weights">
    <Form
      key={JSON.stringify(data.assignment_weights)}
      onSubmit={v => save({
        ...v,
        action: 'assignment_weights'
      })}
    >
      {Object.entries(data.assignment_weights || {}).map(([key, value]) => <Field
        key={key}
        label={key + ' weight'}
        name={key}
        type="number"
        min={0}
        max={1}
        step="0.01"
        defaultValue={value}
        required
      />)}
      <p className="help">
        Weights must total 1. Active technicians are ranked by category skills, unresolved workload, experience and completed incidents for the affected service. Availability is informational. Workload has no cap.
      </p>
    </Form>
  </Card>;
}
export function InfrastructureEditor({ data, save }) {
  const [id, setId] = useState('');
  const [sid, setSid] = useState(String(data.services[0]?.id || ''));
  const component = data.components?.find(c => String(c.id) === id);
  return <>
    <Card title="Infrastructure components">
      <Field
        label="Component to manage"
        name="component_choice"
        value={id}
        onChange={e => setId(e.target.value)}
        options={[{
          value: '',
          label: 'Create component'
        }, ...(data.components || []).map(c => ({
          value: c.id,
          label: c.name
        }))]}
      />
      <Form
        key={id + JSON.stringify(component)}
        onSubmit={v => save({
          ...v,
          id,
          action: 'component'
        })}
      >
        <Field
          label="Component name"
          name="name"
          required
          maxLength={100}
          defaultValue={component?.name || ''}
        />
        <Field
          label="Description"
          name="description"
          maxLength={1000}
          defaultValue={component?.description || ''}
        />
      </Form>
    </Card>
    <Card title="Service dependencies">
      <Field
        label="Service"
        name="service_dependency_service"
        value={sid}
        onChange={e => setSid(e.target.value)}
        options={data.services.map(s => ({
          value: s.id,
          label: s.name
        }))}
      />
      <Form
        key={sid + JSON.stringify(data.service_components)}
        onSubmit={v => save({
          action: 'service_components',
          service_id: sid,
          component_ids: (data.components || []).filter(c => v['component_' + c.id] === 'on').map(c => c.id)
        })}
      >
        <fieldset>
          <legend>
            Components used by this service
          </legend>
          {(data.components || []).map(c => <label
            key={c.id}
            className="service-row"
          >
            <input
              type="checkbox"
              name={'component_' + c.id}
              defaultChecked={(data.service_components || []).some(r => String(r.service_id) === sid && r.component_id === c.id)}
            />
            {c.name}
          </label>)}
          {!data.components?.length && <p>
            Create an infrastructure component first.
          </p>}
        </fieldset>
      </Form>
    </Card>
    <Card title="Correlation window">
      <Form
        key={data.correlation_minutes}
        onSubmit={v => save({
          ...v,
          action: 'correlation_window'
        })}
      >
        <Field
          label="Minutes between related incidents"
          name="minutes"
          type="number"
          min={1}
          max={10080}
          required
          defaultValue={data.correlation_minutes || 60}
        />
        <p className="help">
          A shared service or component suggests a connection. Suggestions do not establish a root cause or merge reports.
        </p>
      </Form>
    </Card>
  </>;
}
export function StorageUsage() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('admin/storage').then(setInfo).catch(e => setError(e.message));
  }, []);
  return <Card title="Database storage usage">
    <ErrorBox message={error} />
    {info ? <>
      <p>
        {info.incidents + ' incidents; ' + info.attachments + ' attachments'}
      </p>
      <p>
        {(info.attachment_bytes / 1048576).toFixed(2) + ' MiB attachment data; ' + (info.record_bytes / 1048576).toFixed(2) + ' MiB logical records'}
      </p>
      <p className="help">
        {info.measurement}
      </p>
      <p className="help">
        Incidents are retained until an administrator explicitly deletes one.
      </p>
    </> : !error && <p role="status">
      Loading usage…
    </p>}
  </Card>;
}
export function DeleteIncident({ incident, onDelete }) {
  return <Card title="Permanently delete incident">
    <p>
      This permanently removes the incident, files, conversations, history, notifications and SLA records. This cannot be undone.
    </p>
    <Form
      submit="Permanently delete"
      onSubmit={v => onDelete(v.confirmation)}
    >
      <Field
        label={'Enter INC-' + String(incident.id).padStart(4, '0') + ' to confirm'}
        name="confirmation"
        required
        autoComplete="off"
      />
    </Form>
  </Card>;
}
