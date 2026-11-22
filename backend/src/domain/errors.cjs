"use strict";
class AppError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code || ({
      400: 'INVALID_USER_INPUT',
      401: 'AUTHENTICATION_REQUIRED',
      403: 'UNAUTHORIZED_OPERATION',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      429: 'RATE_LIMITED',
      503: 'SERVICE_UNAVAILABLE'
    })[status] || 'INTERNAL_ERROR';
  }
}
class InvalidLoginError extends AppError {
  constructor(message = 'Incorrect email or password.') {
    super(message, 401, 'INVALID_LOGIN');
  }
}
class UnauthorizedOperationError extends AppError {
  constructor(message = 'You do not have permission for this action.') {
    super(message, 403, 'UNAUTHORIZED_OPERATION');
  }
}
class Forbidden extends UnauthorizedOperationError {
}
class InvalidIncidentError extends AppError {
  constructor(message = 'Incident not found.') {
    super(message, 404, 'INVALID_INCIDENT');
  }
}
class InvalidStateTransitionError extends AppError {
  constructor(message) {
    super(message, 409, 'INVALID_STATE_TRANSITION');
  }
}
class TechnicianUnavailableError extends AppError {
  constructor(message = 'This technician is not available for assignment. Please select an active technician.') {
    super(message, 409, 'TECHNICIAN_UNAVAILABLE');
  }
}
class TechnicianWorkloadExceededError extends AppError {
  constructor(message = 'Technician workload exceeded. Choose another technician or review their capacity.') {
    super(message, 409, 'TECHNICIAN_WORKLOAD_EXCEEDED');
  }
}
class ServiceNotFoundError extends AppError {
  constructor(message = 'Service not found. Select an existing IT service.') {
    super(message, 404, 'SERVICE_NOT_FOUND');
  }
}
class MissingSLAConfigurationError extends AppError {
  constructor(message = 'SLA configuration is missing. Ask an administrator to configure this service and priority.') {
    super(message, 503, 'MISSING_SLA_CONFIGURATION');
  }
}
class DuplicateIncidentError extends AppError {
  constructor(message) {
    super(message, 409, 'DUPLICATE_INCIDENT');
  }
}
class DatabaseFailureError extends AppError {
  constructor(message = 'We cannot access your records right now. Please try again shortly. If you were submitting an incident, check My Incidents before resubmitting.') {
    super(message, 503, 'DATABASE_FAILURE');
  }
}
class NetworkFailureError extends AppError {
  constructor(message = 'The network request failed. Check the connection and try again.') {
    super(message, 503, 'NETWORK_FAILURE');
  }
}
class InvalidUserInputError extends AppError {
  constructor(message) {
    super(message, 400, 'INVALID_USER_INPUT');
  }
}
function publicError(error) {
  if (error instanceof AppError) {
    return error;
  }
  if (typeof error?.name === 'string' && /^Mongo(?:Network|Server|NotConnected|TopologyClosed|OperationTimeout|WriteConcern|BulkWrite)/.test(error.name)) {
    return new DatabaseFailureError();
  }
  return new AppError('We could not complete your request. Please try again. If the problem continues, contact your administrator.', 500, 'INTERNAL_ERROR');
}
module.exports = {
  AppError,
  Forbidden,
  InvalidLoginError,
  UnauthorizedOperationError,
  InvalidIncidentError,
  InvalidStateTransitionError,
  TechnicianUnavailableError,
  TechnicianWorkloadExceededError,
  ServiceNotFoundError,
  MissingSLAConfigurationError,
  DuplicateIncidentError,
  DatabaseFailureError,
  NetworkFailureError,
  InvalidUserInputError,
  publicError
};
