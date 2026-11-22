import React from '../../lib/react.js';
import { Card, Field, badge } from '../ui.js';
import { AttachmentForm, Attachments } from './AttachmentForm.js';
import { date } from '../../lib/format.js';
export function SupportThread({ incident, user, onAction }) {
  const closed = incident.status === 'CLOSED';
  const operator = user.role === 'admin' || user.role === 'technician' && incident.technician_id === user.id;
  return <Card title="Support requests">
    {!incident.support_requests?.length && <p className="help">
      No requests for additional information.
    </p>}
    {incident.support_requests?.map(request => <article
      className="support-request"
      key={request.id}
    >
      <div className="request-heading">
        <strong>
          {request.requester}
        </strong>
        {badge(request.status === 'pending' ? 'Pending' : 'Responded')}
      </div>
      <p className="description">
        {request.body}
      </p>
      <small>
        {date(request.created_at)}
      </small>
      <Attachments attachments={incident.attachments?.filter(a => a.context === 'request' && a.entry_id === request.id)} />
      {request.responses.map(response => <div
        className="support-response"
        key={response.id}
      >
        <strong>
          Employee response
        </strong>
        <p className="description">
          {response.body}
        </p>
        <small>
          {date(response.created_at)}
        </small>
        <Attachments attachments={incident.attachments?.filter(a => a.context === 'note' && a.entry_id === response.id)} />
      </div>)}
      {!closed && request.status === 'pending' && user.id === incident.reporter_id && <AttachmentForm
        submit="Send response"
        onSubmit={values => onAction({
          ...values,
          action: 'support_response',
          request_id: request.id
        })}
      >
        <Field
          label="Your response"
          name="body"
          type="textarea"
          maxLength={5000}
          placeholder="Answer the support question, or attach the requested information."
        />
      </AttachmentForm>}
    </article>)}
    {operator && !closed && <AttachmentForm
      submit="Request information"
      onSubmit={values => onAction({
        ...values,
        action: 'support_request'
      })}
    >
      <Field
        label="Question for the employee"
        name="body"
        type="textarea"
        required
        maxLength={5000}
      />
    </AttachmentForm>}
  </Card>;
}
export function Feedback({ incident: i, onAction }) {
  return <Card title="Feedback">
    {i.feedback != null ? <div role="status">
      <p>
        {'Your current rating: ' + i.feedback + '/5'}
      </p>
      <p>
        {'Problem resolved: ' + (typeof i.feedback_resolved === 'boolean' ? (i.feedback_resolved ? 'Yes' : 'No') : 'Not recorded')}
      </p>
      {i.feedback_text && <p className="description">
        {i.feedback_text}
      </p>}
      {i.feedback_at && <small>
        {'Submitted ' + date(i.feedback_at)}
      </small>}
    </div> : <AttachmentForm
      files={false}
      submit="Submit feedback"
      onSubmit={values => onAction({
        ...values,
        action: 'feedback',
        resolved: values.resolved === 'yes'
      })}
    >
      <Field
        label="Satisfaction rating"
        name="rating"
        required
        defaultValue=""
        options={[{
          value: '',
          label: 'Select a rating'
        }, ...[
          1,
          2,
          3,
          4,
          5
        ].map(value => ({
          value,
          label: value + ' / 5'
        }))]}
      />
      <Field
        label="Was your problem resolved?"
        name="resolved"
        required
        defaultValue=""
        options={[{
          value: '',
          label: 'Choose an answer'
        }, {
          value: 'yes',
          label: 'Yes'
        }, {
          value: 'no',
          label: 'No'
        }]}
      />
      <Field
        label="Additional comments (optional)"
        name="body"
        type="textarea"
        maxLength={2000}
      />
    </AttachmentForm>}
  </Card>;
}
