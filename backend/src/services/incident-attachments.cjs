'use strict';
const { AppError, now } = require('../domain/index.cjs');
const { createHash } = require('node:crypto');
const MAX_FILE = 2 * 1024 * 1024;
const MAX_TOTAL = 4 * 1024 * 1024;
function validateAttachments(input = []) {
  if (!Array.isArray(input) || input.length > 3) {
    throw new AppError('Attach up to three files.');
  }
  let total = 0;
  return input.map(file => {
    if (!file || typeof file.name !== 'string' || !file.name.isWellFormed() || !/^[^\\/\x00-\x1f\x7f]{1,120}$/.test(file.name) || typeof file.data !== 'string' || file.data.length > Math.ceil(MAX_FILE / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) {
      throw new AppError('Invalid attachment name or encoding.');
    }
    const bytes = Buffer.from(file.data, 'base64');
    total += bytes.length;
    if (!bytes.length || bytes.length > MAX_FILE || total > MAX_TOTAL) {
      throw new AppError('Files must be nonempty, at most 2 MB each and 4 MB combined.');
    }
    const ext = file.name.split('.').pop().toLowerCase();
    let mime;
    if (ext === 'png' && bytes.subarray(0, 8).equals(Buffer.from([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10
    ]))) {
      mime = 'image/png';
    }
    if (['jpg', 'jpeg'].includes(ext) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      mime = 'image/jpeg';
    }
    if (ext === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-') {
      mime = 'application/pdf';
    }
    if (ext === 'txt') {
      try {
        const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
          mime = 'text/plain';
        }
      }
      catch {
      }
    }
    if (!mime) {
      throw new AppError('Only valid PNG, JPEG, PDF and UTF-8 text files are accepted.');
    }
    return {
      name: file.name,
      mime,
      size: bytes.length,
      data: bytes.toString('base64'),
      sha256: createHash('sha256').update(bytes).digest('hex')
    };
  });
}
function saveAttachments(repo, files, incident, user, context, entryId = null) {
  const existing = repo.list('attachments', a => a.incident_id === incident.id).reduce((sum, a) => sum + a.size, 0);
  if (existing + files.reduce((sum, a) => sum + a.size, 0) > 20 * 1024 * 1024) {
    throw new AppError('This incident has reached its 20 MB attachment limit.');
  }
  for (const file of files)
    repo.insert('attachments', {
      ...file,
      incident_id: incident.id,
      user_id: user.id,
      context,
      entry_id: entryId,
      created_at: now()
    });
}
function attachmentMetadata({ data, sha256, ...row }) {
  return row;
}
module.exports = {
  validateAttachments,
  saveAttachments,
  attachmentMetadata,
  MAX_FILE,
  MAX_TOTAL
};
