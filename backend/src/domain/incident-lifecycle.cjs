"use strict";
const { InvalidStateTransitionError } = require("./errors.cjs");
const TRANSITIONS = Object.freeze({
  NEW: ['CLASSIFIED'],
  CLASSIFIED: ['ASSIGNED'],
  ASSIGNED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING', 'RESOLVED'],
  WAITING: ['IN_PROGRESS'],
  RESOLVED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: ['CLOSED'],
  CLOSED: []
});
const FINISHED = ['RESOLVED', 'VERIFIED', 'CLOSED'];
class IncidentLifecycle {
  static validate(old, next) {
    if (!(TRANSITIONS[old] || []).includes(next)) {
      throw new InvalidStateTransitionError('Cannot move from ' + old + ' to ' + next + '.');
    }
  }
}
module.exports = {
  TRANSITIONS,
  FINISHED,
  IncidentLifecycle
};
