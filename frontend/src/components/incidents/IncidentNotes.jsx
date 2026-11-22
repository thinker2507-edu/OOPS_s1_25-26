import React from '../../lib/react.js';
import { Attachments } from './AttachmentForm.js';
import { date } from '../../lib/format.js';
export function IncidentNotes({ incident }) {
  const notes = incident.notes.filter(note => note.kind !== 'support_response').sort((a, b) => b.created_at - a.created_at || b.id - a.id);
  return <div
    className="incident-notes"
    aria-live="polite"
    aria-relevant="additions text"
  >
    {notes.length ? notes.map(note => <article
      key={note.id}
      className="note"
      data-note-id={note.id}
    >
      <strong>
        {note.name}
      </strong>
      <small>
        {' · ' + date(note.created_at)}
      </small>
      {note.body && <p className="description">
        {note.body}
      </p>}
      <Attachments attachments={incident.attachments.filter(file => file.context === 'note' && file.entry_id === note.id)} />
    </article>) : <p className="help">
      No additional information has been added yet.
    </p>}
  </div>;
}
