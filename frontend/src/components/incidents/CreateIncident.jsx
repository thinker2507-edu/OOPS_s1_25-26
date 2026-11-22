import React from "../../lib/react.js";
import { Form, Field } from "../ui.js";
function CreateIncident({ data, onCreate }) {
  return <Form
    submit={'Create incident →'}
    onSubmit={onCreate}
  >
    <p className="description">
      Tell us what happened. Relay calculates priority, classifies the report and assigns an active technician automatically.
    </p>
    <Field
      label="Incident title"
      name="title"
      required
      minLength={5}
      maxLength={160}
      placeholder="e.g. Payment checkout unavailable"
    />
    <Field
      label={'What is happening?'}
      name="description"
      type="textarea"
      required
      minLength={10}
      maxLength={10000}
      placeholder="Include the symptoms, time, and steps you have already tried."
    />
    <div className="form-grid">
      <Field
        label="Affected service"
        name="service_id"
        options={data.services.map(s => ({
          value: s.id,
          label: s.name
        }))}
        required
      />
      <Field
        label="Category"
        name="category"
        options={[{
          value: 'auto',
          label: 'Auto-detect from description'
        }, ...data.categories.map(c => ({
          value: c,
          label: c
        }))]}
      />
      <Field
        label="Business impact"
        name="impact"
        options={[{
          value: 1,
          label: '1 · Individual / minor'
        }, {
          value: 2,
          label: '2 · Team / moderate'
        }, {
          value: 3,
          label: '3 · Organization / severe'
        }]}
      />
      <Field
        label="Urgency"
        name="urgency"
        options={[{
          value: 1,
          label: '1 · Can wait'
        }, {
          value: 2,
          label: '2 · Work is affected'
        }, {
          value: 3,
          label: '3 · Work is blocked'
        }]}
      />
      <Field
        label="Number of affected users"
        name="affected"
        type="number"
        defaultValue={1}
        min={1}
        max={1000000}
        required
      />
    </div>
    <p className="help">
      Priority uses impact × urgency × service criticality, plus 3 points for 100+ users. Similar reports are flagged for review, never discarded.
    </p>
  </Form>;
}
export { CreateIncident };
