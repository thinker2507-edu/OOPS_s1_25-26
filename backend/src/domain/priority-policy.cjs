"use strict";
class PriorityPolicy {
  calculate(impact, urgency, criticality, affected) {
    const score = impact * urgency * criticality + (affected >= 100 ? 3 : 0);
    return {
      priority: score >= 18 ? 'P1' : score >= 9 ? 'P2' : score >= 4 ? 'P3' : 'P4',
      score
    };
  }
}
module.exports = { PriorityPolicy };
