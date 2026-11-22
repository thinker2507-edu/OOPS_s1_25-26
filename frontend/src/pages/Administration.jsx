import React from "../lib/react.js";
import { Card, Form, Field, badge, ErrorBox } from "../components/ui.js";
import { UserEditor, ServiceEditor } from "../components/admin/Editors.js";
import { CatalogEditor, TechnicianEditor } from "../components/admin/CatalogEditor.js";
import { Workload, ServiceHealth } from "../components/dashboard/Widgets.js";
import { AssignmentEditor, InfrastructureEditor, StorageUsage } from '../components/admin/CloudControls.js';
function Administration({ data, save, section }) {
  const form = (title, body) => <Card title={title}>

    {body}

  </Card>;
  const forms = {
    users: () => <div className="admin-grid">

      {form('Create user', <Form
        submit="Create user"
        onSubmit={v => save({
          ...v,
          action: 'user'
        })}
      >

        <Field
          label="Name"
          name="name"
          required
          maxLength={100}
        />

        <Field
          label="Email"
          name="email"
          type="email"
          required
          maxLength={200}
        />

        <Field
          label="Initial password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
        />

        <Field
          label="Role"
          name="role"
          options={['employee', 'technician', 'admin']}
        />

      </Form>)}

      <UserEditor
        data={data}
        save={save}
      />

      <Card title="User directory">

        {data.users.map(u => <div
          className="service-row"
          key={u.id}
        >

          <span>

            {u.name}

            <br />

            <small>

              {u.email}

            </small>

          </span>

          {badge(u.role)}

          {!u.active && <strong>

            Inactive
          </strong>}

        </div>)}

      </Card>

    </div>,
    technicians: () => <div className="admin-grid">

      <Workload data={data} />

      <TechnicianEditor
        data={data}
        save={save}
      />

    </div>,
    services: () => <div className="admin-grid">

      {form('Add IT service', <Form
        submit="Add service"
        onSubmit={v => save({
          ...v,
          action: 'service'
        })}
      >

        <Field
          label="Service name"
          name="name"
          required
          maxLength={100}
        />

        <Field
          label="Business criticality"
          name="criticality"
          options={[1, 2, 3]}
        />

      </Form>)}

      <ServiceEditor
        data={data}
        save={save}
      />

      <ServiceHealth data={data} />
      <InfrastructureEditor data={data} save={save} />
      <StorageUsage />

    </div>,
    categories: () => <div className="admin-grid">

      {form('Add category', <Form
        submit="Add category"
        onSubmit={v => save({
          ...v,
          action: 'category'
        })}
      >

        <Field
          label="Category name"
          name="name"
          required
          maxLength={60}
        />

      </Form>)}

      {form('Rename category', <Form
        submit="Rename category"
        onSubmit={v => save({
          ...v,
          action: 'category_rename'
        })}
      >

        <Field
          label="Existing category"
          name="old"
          options={data.categories}
        />

        <Field
          label="New category name"
          name="name"
          required
          maxLength={60}
        />

      </Form>)}

      <CatalogEditor
        data={data}
        save={save}
      />

      <Card title="Categories">

        {data.categories.map(c => <div
          className="service-row"
          key={c}
        >

          {c}

        </div>)}

      </Card>

    </div>,
    policies: () => <div className="admin-grid">

      {form('SLA policy', <Form onSubmit={v => save({
        ...v,
        action: 'policy'
      })}>

        <Field
          label="Priority"
          name="priority"
          options={['P1', 'P2', 'P3', 'P4']}
        />

        <Field
          label="Applies to service"
          name="service_id"
          options={[{
            value: 0,
            label: 'Global default'
          }, ...data.services.map(s => ({
            value: s.id,
            label: s.name
          }))]}
        />

        <Field
          label={'Response target (minutes)'}
          name="response_minutes"
          type="number"
          min={1}
          max={100000}
          required
        />

        <Field
          label={'Resolution target (minutes)'}
          name="resolution_minutes"
          type="number"
          min={1}
          max={100000}
          required
        />

      </Form>)}

      <Card title="Current SLA targets">

        {data.policies.map(p => <p key={p.priority}>

          {p.priority + ': ' + p.response_minutes + ' min response / ' + p.resolution_minutes + ' min resolution'}

        </p>)}

        <h3>

          Service overrides
        </h3>

        {data.service_policies.length ? data.service_policies.map(p => <p key={p.service_id + p.priority}>

          {data.services.find(s => s.id === p.service_id)?.name + ' ' + p.priority + ': ' + p.response_minutes + '/' + p.resolution_minutes + ' min'}

        </p>) : <p className="help">

          No service overrides.
        </p>}

      </Card>

    </div>,
    assignment: () => <AssignmentEditor data={data} save={save} />
  };
  return forms[section] ? forms[section]() : <ErrorBox message="Administration page not found." />;
}
export { Administration };
