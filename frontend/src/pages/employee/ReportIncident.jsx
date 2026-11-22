import React, { useEffect, useRef, useState } from '../../lib/react.js';
import { api } from '../../services/api.js';
import { Card, ErrorBox, Field, badge, Button } from '../../components/ui.js';
import { AttachmentForm } from '../../components/incidents/AttachmentForm.js';
import { Link } from '../../app/navigation.js';
import { date, incId } from '../../lib/format.js';
export function ReportIncident({ onCreate }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [typeId, setTypeId] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const requestKey = useRef(crypto.randomUUID());
  async function load() {
    setError('');
    try {
      setCatalog(await api('catalog'));
    }
    catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (error) {
    return <><ErrorBox message={error} /><Button onClick={load}>
      Retry catalog
    </Button></>;
  }
  if (!catalog) {
    return <p role="status">
      Loading incident catalog…
    </p>;
  }
  if (submitted) {
    return <Card title="Incident submitted">
      <div role="status">
        <p>
          <strong>
            {incId(submitted.id)}
          </strong>

          {' · ' + submitted.title}
        </p>
        <p>
          {badge(submitted.status)}

          {' · Submitted ' + date(submitted.created_at)}
        </p>
      </div>
      <p>
        {submitted.assignment_problem || 'Your report has been classified and assigned automatically.'}
      </p>
      <Link
        className="btn primary"
        to={'/incidents/' + submitted.id}
      >
        View incident
      </Link>
      {' '}
      <Link
        className="btn"
        to="/incidents/mine"
      >
        My incidents
      </Link>
    </Card>;
  }
  const subcategories = catalog.subcategories.filter(s => s.category === category);
  const types = catalog.incident_types.filter(t => t.subcategory_id === Number(subcategory));
  const type = types.find(t => t.id === Number(typeId));
  const choices = (rows, empty) => [{
    value: '',
    label: empty
  }, ...rows.map(r => ({
    value: r.id,
    label: r.name
  }))];
  return <Card
    title="Incident details"
    subtitle="Choose the problem, then add any details specific to your situation."
  >
    <AttachmentForm
      submit="Submit incident"
      onSubmit={async (values) => {
        if (!type) {
          throw new Error('Choose a category, subcategory and incident type.');
        }
        const result = await onCreate({
          ...values,
          incident_type_id: type.id,
          request_key: requestKey.current
        });
        setSubmitted(result);
      }}
    >
      <Field
        label="Category"
        name="category"
        value={category}
        required
        options={[{
          value: '',
          label: 'Select a category'
        }, ...catalog.categories.map(c => ({
          value: c.name,
          label: c.name
        }))]}
        onChange={e => {
          setCategory(e.target.value);
          setSubcategory('');
          setTypeId('');
        }}
      />
      <Field
        label="Subcategory"
        name="subcategory_id"
        value={subcategory}
        disabled={!category}
        required
        options={choices(subcategories, 'Select a subcategory')}
        onChange={e => {
          setSubcategory(e.target.value);
          setTypeId('');
        }}
      />
      <Field
        label="Incident type / problem"
        name="incident_type_id"
        value={typeId}
        disabled={!subcategory}
        required
        options={choices(types, 'Select an incident type')}
        onChange={e => setTypeId(e.target.value)}
      />
      {category && !subcategories.length && <p role="status">
        This category has no available catalog entries. Please contact support to update the catalog.
      </p>}
      <Field
        label="Objective problem description"
        name="objective_description"
        type="textarea"
        value={type?.objective_description || ''}
        readOnly
        help="This standardized description comes from the incident catalog."
      />
      <Field
        label="Additional details (optional)"
        name="additional_details"
        type="textarea"
        maxLength={10000}
        placeholder="When did it start? What were you trying to do? Include any error message or steps that help support investigate. You do not need to repeat the description above."
      />
    </AttachmentForm>
  </Card>;
}
