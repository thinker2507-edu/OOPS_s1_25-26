// Keeps background reads from overwriting a newly saved incident.
export class IncidentSync {
  constructor({ load, onUpdate, onError }) {
    this.load = load;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.active = true;
    this.generation = 0;
    this.pending = null;
    this.writes = 0;
    this.latest = null;
  }
  publish(incident) {
    const auditId = record => (record?.audit || []).reduce((latest, event) => Math.max(latest, event.id), 0);
    if (this.latest && (auditId(incident) < auditId(this.latest) || auditId(incident) === auditId(this.latest) && incident.updated_at < this.latest.updated_at)) {
      return;
    }
    this.latest = incident;
    this.onUpdate(incident);
  }
  async refresh() {
    if (!this.active || this.pending || this.writes) {
      return;
    }
    const controller = new AbortController();
    const generation = this.generation;
    this.pending = controller;
    try {
      const incident = await this.load(controller.signal);
      if (this.active && generation === this.generation && !controller.signal.aborted) {
        this.publish(incident);
      }
    }
    catch (error) {
      if (this.active && generation === this.generation && !controller.signal.aborted) {
        this.onError(error);
      }
    }
    finally {
      if (this.pending === controller) {
        this.pending = null;
      }
    }
  }
  invalidate() {
    this.generation++;
    this.pending?.abort();
    this.pending = null;
  }
  async mutate(save) {
    this.writes++;
    this.invalidate();
    try {
      const incident = await save();
      if (this.active) {
        this.publish(incident);
      }
      return incident;
    }
    finally {
      this.writes--;
    }
  }
  dispose() {
    this.active = false;
    this.invalidate();
  }
}
