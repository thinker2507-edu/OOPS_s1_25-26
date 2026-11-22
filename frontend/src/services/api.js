let csrf = "";
export function setCsrfToken(value) {
  csrf = value;
}
class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}
function requestError(message, code, status) {
  return new ApiError(message, code, status);
}
async function api(path, data, { signal, timeoutMs = 90000, includeStatus = false, method } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    if (signal?.aborted) {
      throw new DOMException('Request cancelled.', 'AbortError');
    }
    const response = await fetch('/api/' + path, {
      method: method || (data ? 'POST' : 'GET'),
      signal: controller.signal,
      headers: data ? {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf
      } : {},
      body: data ? JSON.stringify(data) : undefined
    });
    let result;
    try {
      result = await response.json();
    }
    catch (error) {
      if (controller.signal.aborted) {
        throw error;
      }
      throw requestError('We could not process the response. Please try again. If you were submitting an incident, check My Incidents before resubmitting.', 'INVALID_RESPONSE', response.status >= 400 ? response.status : 502);
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw requestError('Relay returned an invalid response. Please refresh and try again.', 'INVALID_RESPONSE', 502);
    }
    if (!response.ok) {
      throw requestError(result.error || 'The request could not be completed. Please try again.', result.code || 'REQUEST_FAILED', response.status);
    }
    return includeStatus ? {
      data: result,
      status: response.status
    } : result;
  }
  catch (error) {
    if (signal?.aborted) {
      throw new DOMException('Request cancelled.', 'AbortError');
    }
    if (timedOut) {
      throw requestError('The request timed out. Check your incidents before retrying a submission.', 'NETWORK_FAILURE', 0);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw requestError('Unable to connect to Relay. Check your internet connection and try again. If you were submitting an incident, check My Incidents before retrying.', 'NETWORK_FAILURE', 0);
  }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
export { api };
