import React, { useState } from "../../lib/react.js";
import { Card, Field, Form } from "../ui.js";
function UserEditor({ data, save }) {
  const [id, setId] = useState(String(data.users[0]?.id || ''));
  const [notice, setNotice] = useState('');
  const [passwordRevision, setPasswordRevision] = useState(0);
  const user = data.users.find(u => String(u.id) === id);
  return <Card title="Manage user access">
    <Field
      label="User to manage"
      value={id}
      onChange={e => {
        setId(e.target.value);
        setNotice('');
      }}
      options={data.users.map(u => ({
        value: u.id,
        label: u.name + ' · ' + u.email
      }))}
    />
    {user && <Form
      key={id + '-' + user.role + '-' + user.active}
      submit="Update user"
      onSubmit={v => save({
        ...v,
        id,
        action: 'user_update'
      })}
    >
      <Field
        label="Display name"
        name="name"
        defaultValue={user.name}
        required
        maxLength={100}
      />
      <Field
        label="Account role"
        name="role"
        defaultValue={user.role}
        options={['employee', 'technician', 'admin']}
      />
      <Field
        label="Account access"
        name="active"
        defaultValue={user.active}
        options={[{
          value: 1,
          label: 'Active'
        }, {
          value: 0,
          label: 'Inactive'
        }]}
      />
      <p className="help">
        Reassign active work before disabling technicians. Changing access ends their sessions.
      </p>
    </Form>}
    {user && user.id !== data.user.id && <>
      <h3>
        Reset account password
      </h3>
      <p className="help">
        Set a new password for this user. Their active sessions and outstanding reset links will be revoked; their role and incidents stay the same.
      </p>
      <Form
        key={'password-' + id + '-' + passwordRevision}
        submit="Reset user password"
        onSubmit={async (values) => {
          await save({
            ...values,
            id,
            action: 'user_password_reset'
          });
          setPasswordRevision(value => value + 1);
          setNotice('Password reset. The user can sign in with the new password.');
        }}
      >
        <Field
          label="New password for selected user"
          name="new_password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
        <Field
          label="Confirm new password"
          name="confirm_password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </Form>
    </>}
    {notice && <p role="status">
      {notice}
    </p>}
  </Card>;
}
function ServiceEditor({ data, save }) {
  const [id, setId] = useState(String(data.services[0]?.id || ''));
  const service = data.services.find(s => String(s.id) === id);
  return <Card title="Manage IT services">
    <Field
      label="Service to manage"
      value={id}
      onChange={e => setId(e.target.value)}
      options={data.services.map(s => ({
        value: s.id,
        label: s.name
      }))}
    />
    {service && <Form
      key={id + '-' + service.name + '-' + service.criticality}
      submit="Update service"
      onSubmit={v => save({
        ...v,
        id,
        action: 'service_update'
      })}
    >
      <Field
        label="Service display name"
        name="name"
        defaultValue={service.name}
        required
        maxLength={100}
      />
      <Field
        label="Service criticality"
        name="criticality"
        defaultValue={service.criticality}
        options={[1, 2, 3]}
      />
      <p className="help">
        Criticality affects new incidents and later priority reassessments. Existing deadlines remain attached to their incidents.
      </p>
    </Form>}
  </Card>;
}
export { UserEditor, ServiceEditor };
