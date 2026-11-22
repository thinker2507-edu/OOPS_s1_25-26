import React, { useRef, useState } from '../../lib/react.js';
import { ErrorBox, Field } from '../ui.js';
async function readFiles(files) {
  const selected = Array.from(files);
  if (selected.length > 3 || selected.some(f => f.size > 2 * 1024 * 1024 || f.size === 0) || selected.reduce((sum, f) => sum + f.size, 0) > 4 * 1024 * 1024) {
    throw new Error('Choose up to three nonempty files: 2 MB per file, 4 MB combined.');
  }
  return Promise.all(selected.map(file => new Promise((resolve, reject) => {
    if (!/\.(png|jpe?g|pdf|txt)$/i.test(file.name)) {
      return reject(new Error('Choose a PNG, JPEG, PDF or text file.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read ' + file.name));
    reader.onload = () => resolve({
      name: file.name,
      data: String(reader.result).split(',')[1]
    });
    reader.readAsDataURL(file);
  })));
}
export function AttachmentForm({
  children,
  onSubmit,
  submit,
  files = true,
  reset = true
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  return <form
    aria-busy={busy}
    onSubmit={async (event) => {
      event.preventDefault();
      if (locked.current) {
        return;
      }
      locked.current = true;
      const form = event.currentTarget;
      setBusy(true);
      setError('');
      try {
        const values = Object.fromEntries(new FormData(form));
        delete values.attachments;
        const attachments = files ? await readFiles(form.elements.attachments.files) : [];
        await onSubmit({
          ...values,
          attachments
        });
        if (reset) {
          form.reset();
        }
      }
      catch (error) {
        setError(error.message);
      }
      finally {
        locked.current = false;
        setBusy(false);
      }
    }}
  >
    {children}
    {files && <Field
      label="Attachments (optional)"
      name="attachments"
      type="file"
      accept=".png,.jpg,.jpeg,.pdf,.txt"
      multiple
      help="PNG, JPEG, PDF or text. Up to 3 files, 2 MB each, 4 MB combined. Downloads are restricted to this incident’s authorized users."
    />}
    {error && <ErrorBox message={error} />}
    <div className="modal-actions">
      <button
        className="btn primary"
        disabled={busy}
        type="submit"
      >
        {busy ? 'Saving…' : submit}
      </button>
    </div>
  </form>;
}
function Attachment({ file }) {
  const [failed, setFailed] = useState(false);
  const image = ['image/png', 'image/jpeg'].includes(file.mime);
  const download = '/api/attachments/' + file.id;
  const preview = download + '?preview=1';
  return <li className="attachment-item">
    {image && !failed && <a
      href={preview}
      target="_blank"
      rel="noopener noreferrer"
      className="attachment-preview"
      aria-label={'View ' + file.name + ' (opens in a new tab)'}
    >
      <img
        src={preview}
        alt={'Incident attachment: ' + file.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </a>}
    <div className="attachment-actions">
      {image ? <span>{file.name}</span> : <a href={download} download>{file.name}</a>}
      <small>{' - ' + Math.ceil(file.size / 1024) + ' KB'}</small>
      {image && <>
        <a href={preview} target="_blank" rel="noopener noreferrer">View image<span className="sr-only">: {file.name} (opens in a new tab)</span></a>
        <a href={download} download aria-label={'Download ' + file.name}>Download</a>
      </>}
    </div>
    {image && failed && <p className="help" role="status">The image preview could not be loaded. You can still try opening or downloading the file.</p>}
  </li>;
}
export function Attachments({ attachments = [] }) {
  return attachments.length > 0 && <ul className="attachment-list" aria-label="Supporting attachments">
    {attachments.map(file => <Attachment key={file.id} file={file} />)}
  </ul>;
}
