import React from "../lib/react.js";
import { Card, Form, Field, badge } from "../components/ui.js";
import { pretty, date, incId } from "../lib/format.js";
import { Link } from "../app/navigation.js";
import { SupportThread, Feedback } from "../components/incidents/SupportThread.js";
import { AttachmentForm, Attachments } from "../components/incidents/AttachmentForm.js";
import { IncidentNotes } from "../components/incidents/IncidentNotes.js";
import { FINISHED_UI } from "../lib/incidents.js";
import { DeleteIncident } from '../components/admin/CloudControls.js';
function IncidentWorkspace({ incident: i, data, onAction, section, onDelete }) {
  const u = data.user;
  const operator = u.role === 'admin' || u.role === 'technician' && i.technician_id === u.id;
  const allowed = (data.transitions[i.status] || []).filter(s => s !== "ASSIGNED").filter(s => ['VERIFIED', 'CLOSED'].includes(s) ? u.role === 'admin' || u.id === i.reporter_id : operator || i.status === 'RESOLVED' && s === 'IN_PROGRESS' && u.id === i.reporter_id);
  const quick = u.role === 'technician' && operator ? {
    ASSIGNED: ['Acknowledge incident', 'ACKNOWLEDGED'],
    ACKNOWLEDGED: ['Start investigation', 'IN_PROGRESS'],
    WAITING: ['Resume investigation', 'IN_PROGRESS']
  }[i.status] : null;
  const progress = quick ? <Card title="Next step">

    <Form
      submit={quick[0]}
      onSubmit={values => onAction({
        ...values,
        action: 'status',
        status: quick[1]
      })}
    >

      <p>
        {i.status === 'ASSIGNED' ? 'Confirm that you have received this assignment.' : 'Record the next investigation step.'}
      </p>

      <Field
        label="Remarks (optional)"
        name="remarks"
        maxLength={5000}
      />

    </Form>

  </Card> : allowed.length > 0 && <Card title="Next step">

    <AttachmentForm
      files={allowed.includes('RESOLVED')}
      submit="Update status"
      onSubmit={values => onAction({
        ...values,
        action: 'status'
      })}
    >

      <Field
        label="Next status"
        name="status"
        options={allowed.map(status => ({
          value: status,
          label: pretty(status)
        }))}
      />

      <Field
        label="Transition remarks (optional)"
        name="remarks"
        maxLength={5000}
      />

      {allowed.includes('RESOLVED') && <>
        <Field
          label="Resolution details"
          name="resolution"
          type="textarea"
          maxLength={10000}
          help="Required when resolving an incident."
        />
        <Field
          label="Actions performed (optional)"
          name="resolution_actions"
          type="textarea"
          maxLength={10000}
        />
        <Field
          label="Support remarks (optional)"
          name="resolution_remarks"
          type="textarea"
          maxLength={5000}
        />
      </>}

    </AttachmentForm>

  </Card>;
  const nav = [['Overview', ''], ['Conversation', '/conversation'], ['Resolution', '/resolution'], ['Activity', '/activity']];
  return <div className="incident-page">
    {i.assignment_problem && <p role="status">{i.assignment_problem}</p>}
    <p className="help">{i.urgency_reason}</p>
    {u.role === 'admin' && section === 'activity' && <DeleteIncident incident={i} onDelete={onDelete} />}



    <div className="record-summary">



      {badge(i.priority)}



      {' '}



      {badge(i.status)}



      {' '}



      <span className="help">



        {'Reported ' + date(i.created_at)}



      </span>



    </div>



    <nav
      className="page-tabs"
      aria-label="Incident sections"
    >



      {nav.map(([label, suffix]) => <Link
        key={label}
        to={'/incidents/' + i.id + suffix}
        aria-current={section === (suffix.slice(1) || 'overview') ? 'page' : undefined}
      >



        {label}



      </Link>)}



    </nav>



    {section === 'overview' && <div className="detail-grid">



      <div>



        <Card title="Incident details">



          <p className="description">



            {i.description}



          </p>



          <Attachments attachments={i.attachments?.filter(a => a.context === 'report')} />



          <div className="detail-meta">



            {[
              ['Service', data.services.find(s => s.id === i.service_id)?.name],
              ['Category', i.category],
              ['Assigned to', data.technicians.find(t => t.id === i.technician_id)?.name || data.incidents.find(t => t.id === i.id)?.technician || 'Unassigned'],
              ['Response due', date(i.response_due)],
              ['Resolution due', date(i.resolution_due)],
              ['Priority score', i.score]
            ].map(([label, value]) => <div key={label}>



              <small>



                {label}



              </small>



              <strong>



                {value}



              </strong>



            </div>)}



          </div>



          {i.duplicate_of && <p className="callout">



            {'Possible duplicate: ' + incId(i.duplicate_of) + '. A technician should review these reports.'}



          </p>}



        </Card>



        {progress}



      </div>



      <div>



        {u.role === 'admin' && !FINISHED_UI.includes(i.status) && <Card title="Technician assignment">



          <Form
            submit="Reassign automatically"
            onSubmit={() => onAction({ action: "auto_assign" })}
          >


            <p className="help">


              Uses the configured weights to select an active technician. New reports are assigned automatically.
            </p>


          </Form>



          <Form
            submit="Assign technician"
            onSubmit={v => onAction({
              ...v,
              action: 'assign'
            })}
          >



            <Field
              label="Technician"
              name="technician_id"
              defaultValue={i.technician_id || ''}
              required
              options={[{
                value: '',
                label: 'Choose a technician'
              }, ...data.technicians.map(t => ({
                value: t.id,
                label: t.name + ' · ' + t.workload + ' unresolved' + (t.available ? '' : ' · Away')
              }))]}
            />



          </Form>



        </Card>}



        {operator && !FINISHED_UI.includes(i.status) && <Card title="Reassess priority">



          <Form
            submit="Recalculate priority"
            onSubmit={v => onAction({
              ...v,
              action: 'edit'
            })}
          >



            <Field
              label="Impact"
              name="impact"
              defaultValue={i.impact}
              options={[1, 2, 3]}
            />



            <Field
              label="Urgency"
              name="urgency"
              defaultValue={i.urgency}
              options={[1, 2, 3]}
            />



          </Form>



        </Card>}



        {operator && !i.incident_type_id && <Card title="Correct classification">



          <Form
            submit="Update category"
            onSubmit={v => onAction({
              ...v,
              action: 'category'
            })}
          >



            <Field
              label="Category"
              name="category"
              defaultValue={i.category}
              options={data.categories}
            />



          </Form>



        </Card>}



      </div>



    </div>}



    {section === 'conversation' && <div className="detail-grid">



      <SupportThread
        incident={i}
        user={u}
        onAction={onAction}
      />



      <Card title="Conversation & investigation">

        <IncidentNotes incident={i} />

        {operator && i.status !== 'CLOSED' && <AttachmentForm
          submit="Add investigation note"
          onSubmit={values => onAction({
            ...values,
            action: 'investigation'
          })}
        >

          <Field
            label="Investigation note"
            name="body"
            type="textarea"
            maxLength={5000}
            placeholder="Record diagnostic checks, findings and the next step."
            help="These notes and files are shared with the reporting employee."
          />

        </AttachmentForm>}

        {i.status === 'CLOSED' && <p className="help">
          The incident is closed. Recorded investigation remains available.
        </p>}

      </Card>

      <Card title="Potential duplicates">
        <p className="help">Suggestions require human review. Reports remain separate.</p>



        {i.related?.length ? i.related.map(r => <article
          className="note"
          key={r.id}
        >



          <Link to={'/incidents/' + r.id}>



            {incId(r.id) + ' · ' + r.title}



          </Link>



          <p className="help">



            {r.similarity + '% similarity · ' + (r.reasons || []).join('; ')}



          </p>



          {r.resolution && <p>



            {'Previous resolution: ' + r.resolution}



          </p>}



        </article>) : <p className="help">



          No related reports are available in this view.
        </p>}



      </Card>
      <Card title="Service and component correlations">
        <p className="help">Incidents close in time with shared dependencies. A connection does not confirm a root cause.</p>
        {i.correlations?.length ? i.correlations.map(r => <article className="note" key={r.id}>
          <Link to={'/incidents/' + r.id}>{incId(r.id) + ' · ' + r.title}</Link>
          <p className="help">{r.reasons.join('; ') + ' · ' + r.minutes_apart + ' minutes apart'}</p>
        </article>) : <p className="help">No service or component correlations in the configured window.</p>}
      </Card>



    </div>}



    {section === 'resolution' && <div className="detail-grid">



      <div>



        <Card title="Resolution">


          {FINISHED_UI.includes(i.status) && <><p className="description">

            {i.resolution_actions}

          </p><p className="description">

              {i.resolution_remarks}

            </p><Attachments attachments={i.attachments?.filter(a => a.context === "resolution")} /></>}



          {FINISHED_UI.includes(i.status) && i.resolution ? <p className="description">



            {i.resolution}



          </p> : <p className="help">



            A technician has not supplied a resolution yet.
          </p>}



        </Card>



        {progress}



      </div>



      {FINISHED_UI.includes(i.status) && (u.id === i.reporter_id || i.feedback != null) && <Feedback
        incident={i}
        onAction={onAction}
      />}



    </div>}



    {section === 'activity' && <Card title="Activity history">



      <div className="timeline">



        {i.audit.map(a => <article
          className="timeline-item"
          key={a.id}
        >



          <strong>



            {a.action}



          </strong>



          <p>



            {a.detail}



          </p>



          <small>



            {a.actor + ' · ' + date(a.created_at) + (a.old_state ? ' · ' + a.old_state + ' → ' + a.new_state : '')}



          </small>



        </article>)}



      </div>



    </Card>}



  </div>;
}
export { IncidentWorkspace };
