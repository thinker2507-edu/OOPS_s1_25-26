import React from '../../lib/react.js';
import { Card, Field, Form, badge } from '../../components/ui.js';
import { AttachmentForm, Attachments } from '../../components/incidents/AttachmentForm.js';
import { SupportThread, Feedback } from '../../components/incidents/SupportThread.js';
import { date, pretty } from '../../lib/format.js';
import { Link } from '../../app/navigation.js';
import { FINISHED_UI } from '../../lib/incidents.js';
import { IncidentNotes } from '../../components/incidents/IncidentNotes.js';
const STAGES = [
  'NEW',
  'CLASSIFIED',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'VERIFIED',
  'CLOSED'
];
export function LifecycleTracker({ incident: i }) {
  const recorded = new Set(i.audit.flatMap(a => a.old_state ? [a.old_state, a.new_state] : a.action === 'Incident created' ? [a.new_state] : []));
  return <Card
    title="Incident progress"
    subtitle={'Current stage: ' + pretty(i.status)}
  >
    <ol
      className="lifecycle-tracker"
      aria-label="Incident lifecycle"
    >
      {STAGES.map(stage => <li
        key={stage}
        aria-current={i.status === stage ? 'step' : undefined}
        className={i.status === stage ? 'current' : recorded.has(stage) ? 'completed' : 'upcoming'}
      >
        <span aria-hidden="true">
          {i.status === stage ? '●' : recorded.has(stage) ? '✓' : '○'}
        </span>
        <span>
          {pretty(stage)}
          <small>
            {i.status === stage ? 'Current' : recorded.has(stage) ? 'Recorded' : 'Not recorded'}
          </small>
        </span>
      </li>)}
    </ol>
    {i.status === 'WAITING' && <p role="status">
      Support is waiting for information before continuing work.
    </p>}
    <p className="help">
      Only recorded stages are marked. Older incidents may have gaps in their history.
    </p>
  </Card>;
}
export function EmployeeIncidentDetail({ incident: i, data, onAction, section }) {
  const finished = FINISHED_UI.includes(i.status);
  const permitted = (data.transitions[i.status] || []).filter(s => ['VERIFIED', 'CLOSED'].includes(s) || i.status === 'RESOLVED' && s === 'IN_PROGRESS');
  const navigation = [['Overview', ''], ['Conversation', '/conversation'], ['Resolution', '/resolution'], ['Activity', '/activity']];
  const resolution = finished && <Card title="Resolution">
    <p className="description">
      {i.resolution || 'No resolution summary was recorded.'}
    </p>
    {i.resolution_actions && <><h3>
      Actions performed
    </h3><p className="description">
        {i.resolution_actions}
      </p></>}
    {i.resolution_remarks && <><h3>
      Support remarks
    </h3><p className="description">
        {i.resolution_remarks}
      </p></>}
    <p className="help">
      {'Resolved ' + date(i.resolved_at)}
    </p>
    <Attachments attachments={i.attachments.filter(a => a.context === 'resolution')} />
    {section === 'overview' && <Link
      className="btn"
      to={'/incidents/' + i.id + '/resolution'}
    >
      Review resolution and feedback
    </Link>}
  </Card>;
  return <div className="incident-page employee-detail">
    {i.assignment_problem && <p role="status">{i.assignment_problem}</p>}
    <div className="record-summary">
      {badge(i.status)}

      <span className="help">
        {'Submitted ' + date(i.created_at) + ' · Updated ' + date(i.updated_at)}
      </span>
    </div>
    <nav
      className="page-tabs"
      aria-label="Incident sections"
    >
      {navigation.map(([label, suffix]) => <Link
        key={label}
        to={'/incidents/' + i.id + suffix}
        aria-current={section === (suffix.slice(1) || 'overview') ? 'page' : undefined}
      >
        {label}
      </Link>)}
    </nav>
    {section === 'overview' && <>
      <LifecycleTracker incident={i} />
      <Card title="Incident information">
        <dl className="employee-metadata">
          {[
            ['Category', i.category],
            ['Subcategory', i.subcategory || 'Not recorded'],
            ['Incident type', i.incident_type || i.title],
            ['Assigned support', i.technician || 'Awaiting assignment'],
            ['Submitted', date(i.created_at)],
            ['Last updated', date(i.updated_at)]
          ].map(([key, value]) => <div key={key}>
            <dt>
              {key}
            </dt>
            <dd>
              {value}
            </dd>
          </div>)}
        </dl>
        <h3>
          {i.objective_description ? 'Objective problem description' : 'Original report'}
        </h3>
        <p className="description">
          {i.objective_description || i.description}
        </p>
        {i.additional_details && <><h3>
          Details submitted with this incident
        </h3><p className="description">
            {i.additional_details}
          </p></>}
        <Attachments attachments={i.attachments.filter(a => a.context === 'report')} />
      </Card>
      <div className="additional-information">
        <Card
          title="Additional information"
          action={<Link to={'/incidents/' + i.id + '/conversation'}>
            {i.status === 'CLOSED' ? 'View conversation' : 'Add more information'}
          </Link>}
        >
          <IncidentNotes incident={i} />
        </Card>
      </div>
      {resolution}
      {i.support_requests.some(r => r.status === 'pending') && <p className="callout">
        <Link to={'/incidents/' + i.id + '/conversation'}>
          Support needs your response. View requests.
        </Link>
      </p>}
    </>}
    {section === 'conversation' && <>
      <SupportThread
        incident={i}
        user={data.user}
        onAction={onAction}
      />
      <Card title="Additional information and notes">
        <IncidentNotes incident={i} />
        {i.status !== 'CLOSED' ? <AttachmentForm
          submit="Add information"
          onSubmit={values => onAction({
            ...values,
            action: 'information'
          })}
        >
          <Field
            label="Additional information"
            name="body"
            type="textarea"
            maxLength={5000}
            placeholder="Add new observations, error messages or supporting information."
          />
        </AttachmentForm> : <p className="help">
          This incident is closed. Its conversation remains available for reference.
        </p>}
      </Card>
    </>}
    {section === 'resolution' && <>
      {resolution || <Card title="Resolution">
        <p>
          Support has not completed a resolution yet.
        </p>
      </Card>}
      {permitted.length > 0 && <Card title="Review resolution">
        <p>
          Verification and closure follow your explicit review. Feedback alone does not change the incident status.
        </p>
        <Form
          submit="Update status"
          onSubmit={values => onAction({
            ...values,
            action: 'status'
          })}
        >
          <Field
            label="Next status"
            name="status"
            options={permitted.map(s => ({
              value: s,
              label: pretty(s)
            }))}
          />
        </Form>
      </Card>}
      {finished && <Feedback
        incident={i}
        onAction={onAction}
      />}
    </>}
    {section === 'activity' && <Card title="Activity history">
      <div className="timeline">
        {[...i.audit].sort((a, b) => a.created_at - b.created_at || a.id - b.id).map(a => <article
          className="timeline-item"
          key={a.id}
        >
          <strong>
            {a.action}
          </strong>
          <p className="description">
            {a.detail}
          </p>
          <small>
            {a.actor}

            ·
            {date(a.created_at)}
            {a.old_state ? ' · ' + pretty(a.old_state) + ' → ' + pretty(a.new_state) : ''}
          </small>
        </article>)}
      </div>
    </Card>}
  </div>;
}
