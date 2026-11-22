import React, { useState } from '../../lib/react.js';
import { Card, Field, Form } from '../ui.js';
export function TechnicianEditor({ data, save }) {
  const [id, setId] = useState(String(data.technicians[0]?.id || ''));
  const tech = data.technicians.find(row => String(row.id) === id);
  return <Card title="Technician availability & skills">
    <Field
      label="Technician"
      name="technician_choice"
      value={id}
      onChange={event => setId(event.target.value)}
      options={data.technicians.map(row => ({
        value: row.id,
        label: row.name
      }))}
    />
    {tech ? <Form
      key={id + '-' + tech.available + '-' + tech.experience_years + '-' + tech.skills}
      onSubmit={values => save({
        ...values,
        id,
        action: 'technician'
      })}
    >
      <Field
        label="Availability (informational)"
        name="available"
        defaultValue={tech.available}
        options={[{
          value: 1,
          label: 'Available'
        }, {
          value: 0,
          label: 'Away'
        }]}
      />
      <Field
        label="Experience in years"
        name="experience_years"
        type="number"
        min={0}
        max={80}
        step="0.1"
        required
        defaultValue={tech.experience_years || 0}
      />
      <Field
        label="Skills"
        name="skills"
        maxLength={500}
        defaultValue={tech.skills}
        help={'Comma-separated categories: ' + data.categories.join(', ')}
      />
    </Form> : <p className="help">
      Create a technician account in User management first.
    </p>}
  </Card>;
}
export function CatalogEditor({ data, save }) {
  const [subId, setSubId] = useState('');
  const [typeId, setTypeId] = useState('');
  const catalog = data.catalog || {
    subcategories: [],
    incident_types: []
  };
  const sub = catalog.subcategories.find(row => String(row.id) === subId);
  const type = catalog.incident_types.find(row => String(row.id) === typeId);
  const access = [{
    value: 1,
    label: 'Active'
  }, {
    value: 0,
    label: 'Inactive'
  }];
  return <>
    <Card title="Manage subcategories">
      <Field
        label="Subcategory to manage"
        name="catalog_subcategory"
        value={subId}
        onChange={event => setSubId(event.target.value)}
        options={[{
          value: '',
          label: 'Create a subcategory'
        }, ...catalog.subcategories.map(row => ({
          value: row.id,
          label: row.category + ' / ' + row.name + (row.active === false ? ' (Inactive)' : '')
        }))]}
      />
      <Form
        key={subId + '-' + JSON.stringify(sub)}
        submit="Save subcategory"
        onSubmit={values => save({
          ...values,
          id: subId,
          action: 'subcategory'
        })}
      >
        <Field
          label="Parent category"
          name="category"
          required
          defaultValue={sub?.category || data.categories[0]}
          options={data.categories}
        />
        <Field
          label="Subcategory name"
          name="name"
          required
          maxLength={100}
          defaultValue={sub?.name || ''}
        />
        <Field
          label="Availability"
          name="active"
          defaultValue={sub?.active === false ? 0 : 1}
          options={access}
        />
      </Form>
    </Card>
    <Card title="Manage incident types">
      <Field
        label="Incident type to manage"
        name="catalog_incident_type"
        value={typeId}
        onChange={event => setTypeId(event.target.value)}
        options={[{
          value: '',
          label: 'Create an incident type'
        }, ...catalog.incident_types.map(row => ({
          value: row.id,
          label: row.name + (row.active === false ? ' (Inactive)' : '')
        }))]}
      />
      {catalog.subcategories.length ? <Form
        key={typeId + '-' + JSON.stringify(type)}
        submit="Save incident type"
        onSubmit={values => save({
          ...values,
          id: typeId,
          action: 'incident_type'
        })}
      >
        <Field
          label="Parent subcategory"
          name="subcategory_id"
          required
          defaultValue={type?.subcategory_id || catalog.subcategories[0]?.id}
          options={catalog.subcategories.map(row => ({
            value: row.id,
            label: row.category + ' / ' + row.name
          }))}
        />
        <Field
          label="Incident type name"
          name="name"
          required
          minLength={5}
          maxLength={160}
          defaultValue={type?.name || ''}
        />
        <Field
          label="Objective problem description"
          name="objective_description"
          type="textarea"
          required
          minLength={10}
          maxLength={10000}
          defaultValue={type?.objective_description || ''}
        />
        <Field
          label="Affected service"
          name="service_id"
          required
          defaultValue={type?.service_id || data.services[0]?.id}
          options={data.services.map(row => ({
            value: row.id,
            label: row.name
          }))}
        />
        <Field
          label="Availability"
          name="active"
          defaultValue={type?.active === false ? 0 : 1}
          options={access}
        />
        <p className="help">
          Catalog edits affect future reports. Submitted incident descriptions remain in their history.
        </p>
      </Form> : <p className="help">
        Create a subcategory first.
      </p>}
    </Card>
  </>;
}
