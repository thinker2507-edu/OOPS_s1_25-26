"use strict";
const DEFAULT_WEIGHTS = Object.freeze({
  skills: .5,
  workload: .25,
  experience: .15,
  service: .1
});
class AssignmentStrategy {
  choose() {
    throw new Error('AssignmentStrategy.choose must be implemented.');
  }
  eligible(technicians) {
    return technicians.filter(t => t.active !== 0 && t.active !== false);
  }
}
class SkillBasedAssignment extends AssignmentStrategy {
  choose(technicians, category, { weights = DEFAULT_WEIGHTS, reporterId } = {}) {
    let candidates = this.eligible(technicians);
    if (candidates.some(t => t.id !== reporterId)) {
      candidates = candidates.filter(t => t.id !== reporterId);
    }
    const score = t => weights.skills * Number((t.skills || '').split(',').map(s => s.trim().toLowerCase()).includes(category.toLowerCase()))
      + weights.workload / (1 + t.workload)
      + weights.experience * Math.min(t.experience_years || 0, 10) / 10
      + weights.service * (t.completed || 0) / ((t.completed || 0) + 5);
    return candidates.sort((a, b) => score(b) - score(a) || a.workload - b.workload
      || (a.last_assigned_at || 0) - (b.last_assigned_at || 0) || a.id - b.id)[0] || null;
  }
}
class LoadBasedAssignment extends SkillBasedAssignment {
}
const STRATEGIES = Object.freeze({
  skill: new SkillBasedAssignment(),
  load: new LoadBasedAssignment()
});
module.exports = {
  AssignmentStrategy,
  SkillBasedAssignment,
  LoadBasedAssignment,
  STRATEGIES,
  DEFAULT_WEIGHTS
};
