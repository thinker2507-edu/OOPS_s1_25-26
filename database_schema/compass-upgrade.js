/* Generated from the canonical schema. Paste this entire file into Compass mongosh,
   then call relaySchema.preview("relay") and relaySchema.apply("relay").
   Defining these helpers does not access the database. Compass may not support load(). */
globalThis.relaySchema = (() => {
  const schema = {
  "version": "cloud-incident-intelligence-v1",
  "roles": [
    "employee",
    "technician",
    "admin"
  ],
  "statuses": [
    "NEW",
    "CLASSIFIED",
    "ASSIGNED",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "WAITING",
    "RESOLVED",
    "VERIFIED",
    "CLOSED"
  ],
  "transitions": {
    "NEW": [
      "CLASSIFIED"
    ],
    "CLASSIFIED": [
      "ASSIGNED"
    ],
    "ASSIGNED": [
      "ACKNOWLEDGED"
    ],
    "ACKNOWLEDGED": [
      "IN_PROGRESS"
    ],
    "IN_PROGRESS": [
      "WAITING",
      "RESOLVED"
    ],
    "WAITING": [
      "IN_PROGRESS"
    ],
    "RESOLVED": [
      "VERIFIED",
      "IN_PROGRESS"
    ],
    "VERIFIED": [
      "CLOSED"
    ],
    "CLOSED": []
  },
  "collections": {
    "users": {
      "keys": [
        "id"
      ],
      "defaults": {
        "role": "employee",
        "skills": "",
        "available": 1,
        "experience_years": 0,
        "last_assigned_at": 0,
        "active": 1
      },
      "fields": [
        "id",
        "name",
        "email",
        "password",
        "role",
        "skills",
        "available",
        "experience_years",
        "last_assigned_at",
        "active",
        "created_at",
        "updated_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "name": "string",
        "email": "string",
        "password": "string: PBKDF2 hash; never plaintext",
        "role": "enum: employee | technician | admin",
        "skills": "string",
        "available": "integer: 0 | 1",
        "experience_years": "number: years, 0..80",
        "last_assigned_at": "number: Unix seconds (nullable when not reached)",
        "active": "integer: 0 | 1",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "updated_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "components": {
      "keys": [
        "id"
      ],
      "defaults": {},
      "fields": [
        "id",
        "name",
        "description"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "name": "string",
        "description": "string"
      }
    },
    "service_components": {
      "keys": [
        "service_id",
        "component_id"
      ],
      "defaults": {},
      "fields": [
        "service_id",
        "component_id"
      ],
      "types": {
        "service_id": "number: integer ID/value; optional references may be null",
        "component_id": "number: integer ID/value; optional references may be null"
      }
    },
    "rate_limits": {
      "keys": [
        "key"
      ],
      "defaults": {},
      "fields": [
        "key",
        "count",
        "expires"
      ],
      "types": {
        "key": "string",
        "count": "number: integer ID/value; optional references may be null",
        "expires": "number: Unix seconds (nullable when not reached)"
      }
    },
    "services": {
      "keys": [
        "id"
      ],
      "defaults": {},
      "fields": [
        "id",
        "name",
        "criticality"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "name": "string",
        "criticality": "number: integer ID/value; optional references may be null"
      }
    },
    "categories": {
      "keys": [
        "name"
      ],
      "defaults": {},
      "fields": [
        "name"
      ],
      "types": {
        "name": "string"
      }
    },
    "subcategories": {
      "keys": [
        "id"
      ],
      "defaults": {
        "active": true
      },
      "fields": [
        "id",
        "category",
        "name",
        "active",
        "created_at",
        "updated_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "category": "string",
        "name": "string",
        "active": "boolean",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "updated_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "incident_types": {
      "keys": [
        "id"
      ],
      "defaults": {
        "active": true
      },
      "fields": [
        "id",
        "subcategory_id",
        "name",
        "objective_description",
        "service_id",
        "active",
        "created_at",
        "updated_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "subcategory_id": "number: integer ID/value; optional references may be null",
        "name": "string",
        "objective_description": "string",
        "service_id": "number: integer ID/value; optional references may be null",
        "active": "boolean",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "updated_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "attachments": {
      "keys": [
        "id"
      ],
      "defaults": {},
      "fields": [
        "id",
        "incident_id",
        "user_id",
        "context",
        "entry_id",
        "name",
        "mime",
        "size",
        "data",
        "sha256",
        "created_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "incident_id": "number: integer ID/value; optional references may be null",
        "user_id": "number: integer ID/value; optional references may be null",
        "context": "string",
        "entry_id": "number: integer ID/value; optional references may be null",
        "name": "string",
        "mime": "string",
        "size": "number: integer ID/value; optional references may be null",
        "data": "string",
        "sha256": "string",
        "created_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "support_requests": {
      "keys": [
        "id"
      ],
      "defaults": {
        "status": "pending"
      },
      "fields": [
        "id",
        "incident_id",
        "user_id",
        "body",
        "status",
        "created_at",
        "responded_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "incident_id": "number: integer ID/value; optional references may be null",
        "user_id": "number: integer ID/value; optional references may be null",
        "body": "string",
        "status": "enum: pending | responded",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "responded_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "policies": {
      "keys": [
        "priority"
      ],
      "defaults": {},
      "fields": [
        "priority",
        "response_minutes",
        "resolution_minutes"
      ],
      "types": {
        "priority": "enum: P1 | P2 | P3 | P4",
        "response_minutes": "number: integer ID/value; optional references may be null",
        "resolution_minutes": "number: integer ID/value; optional references may be null"
      }
    },
    "settings": {
      "keys": [
        "key"
      ],
      "defaults": {},
      "fields": [
        "key",
        "value",
        "applied_at"
      ],
      "types": {
        "key": "string",
        "value": "string | number | object (assignment weights)",
        "applied_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "incidents": {
      "keys": [
        "id"
      ],
      "defaults": {
        "status": "NEW",
        "technician_id": null,
        "acknowledged_at": null,
        "resolved_at": null,
        "closed_at": null,
        "resolution": "",
        "feedback": null,
        "feedback_text": "",
        "duplicate_of": null
      },
      "fields": [
        "id",
        "title",
        "description",
        "reporter_id",
        "service_id",
        "category",
        "subcategory_id",
        "subcategory",
        "incident_type_id",
        "incident_type",
        "objective_description",
        "additional_details",
        "impact",
        "urgency",
        "affected",
        "priority",
        "score",
        "status",
        "technician_id",
        "created_at",
        "updated_at",
        "response_due",
        "resolution_due",
        "acknowledged_at",
        "resolved_at",
        "closed_at",
        "resolution",
        "resolution_actions",
        "resolution_remarks",
        "feedback",
        "feedback_text",
        "feedback_resolved",
        "feedback_at",
        "feedback_by",
        "duplicate_of",
        "request_key",
        "request_fingerprint",
        "assignment_problem"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "title": "string",
        "description": "string",
        "reporter_id": "number: integer ID/value; optional references may be null",
        "service_id": "number: integer ID/value; optional references may be null",
        "category": "string",
        "subcategory_id": "number: integer ID/value; optional references may be null",
        "subcategory": "string",
        "incident_type_id": "number: integer ID/value; optional references may be null",
        "incident_type": "string",
        "objective_description": "string",
        "additional_details": "string",
        "impact": "number: integer ID/value; optional references may be null",
        "urgency": "number: integer ID/value; optional references may be null",
        "affected": "number: integer ID/value; optional references may be null",
        "priority": "enum: P1 | P2 | P3 | P4",
        "score": "number: integer ID/value; optional references may be null",
        "status": "enum: NEW | CLASSIFIED | ASSIGNED | ACKNOWLEDGED | IN_PROGRESS | WAITING | RESOLVED | VERIFIED | CLOSED",
        "technician_id": "number: integer ID/value; optional references may be null",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "updated_at": "number: Unix seconds (nullable when not reached)",
        "response_due": "number: Unix seconds (nullable when not reached)",
        "resolution_due": "number: Unix seconds (nullable when not reached)",
        "acknowledged_at": "number: Unix seconds (nullable when not reached)",
        "resolved_at": "number: Unix seconds (nullable when not reached)",
        "closed_at": "number: Unix seconds (nullable when not reached)",
        "resolution": "string",
        "resolution_actions": "string",
        "resolution_remarks": "string",
        "feedback": "number: integer ID/value; optional references may be null",
        "feedback_text": "string",
        "feedback_resolved": "boolean (optional)",
        "feedback_at": "number: Unix seconds (nullable when not reached)",
        "feedback_by": "number: integer ID/value; optional references may be null",
        "duplicate_of": "number: integer ID/value; optional references may be null",
        "request_key": "string",
        "request_fingerprint": "string",
        "assignment_problem": "string"
      }
    },
    "notes": {
      "keys": [
        "id"
      ],
      "defaults": {
        "kind": "note"
      },
      "fields": [
        "id",
        "incident_id",
        "user_id",
        "body",
        "kind",
        "support_request_id",
        "created_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "incident_id": "number: integer ID/value; optional references may be null",
        "user_id": "number: integer ID/value; optional references may be null",
        "body": "string",
        "kind": "enum: note | information | investigation | support_response",
        "support_request_id": "number: integer ID/value; optional references may be null",
        "created_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "audit": {
      "keys": [
        "id"
      ],
      "defaults": {
        "incident_id": null,
        "user_id": null,
        "old_state": null,
        "new_state": null
      },
      "fields": [
        "id",
        "incident_id",
        "user_id",
        "action",
        "old_state",
        "new_state",
        "detail",
        "created_at"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "incident_id": "number: integer ID/value; optional references may be null",
        "user_id": "number: integer ID/value; optional references may be null",
        "action": "string",
        "old_state": "incident status or null (configuration audit)",
        "new_state": "incident status or null (configuration audit)",
        "detail": "string",
        "created_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "notifications": {
      "keys": [
        "id"
      ],
      "defaults": {
        "is_read": 0
      },
      "fields": [
        "id",
        "user_id",
        "incident_id",
        "message",
        "channel",
        "is_read",
        "created_at",
        "sent_at",
        "retry_at",
        "delivery_claim",
        "delivery_status"
      ],
      "types": {
        "id": "number: integer ID/value; optional references may be null",
        "user_id": "number: integer ID/value; optional references may be null",
        "incident_id": "number: integer ID/value; optional references may be null",
        "message": "string",
        "channel": "string",
        "is_read": "integer: 0 | 1",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "sent_at": "number: Unix seconds (nullable when not reached)",
        "retry_at": "number: Unix seconds (nullable when not reached)",
        "delivery_claim": "string",
        "delivery_status": "string"
      }
    },
    "sessions": {
      "keys": [
        "token"
      ],
      "defaults": {},
      "fields": [
        "token",
        "user_id",
        "csrf",
        "expires",
        "auth_method"
      ],
      "types": {
        "token": "string",
        "user_id": "number: integer ID/value; optional references may be null",
        "csrf": "string",
        "expires": "number: Unix seconds (nullable when not reached)",
        "auth_method": "string"
      }
    },
    "password_resets": {
      "keys": [
        "token_hash"
      ],
      "defaults": {
        "used_at": null,
        "revoked_at": null
      },
      "fields": [
        "token_hash",
        "user_id",
        "created_at",
        "expires",
        "used_at",
        "revoked_at"
      ],
      "types": {
        "token_hash": "string",
        "user_id": "number: integer ID/value; optional references may be null",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "expires": "number: Unix seconds (nullable when not reached)",
        "used_at": "number: Unix seconds (nullable when not reached)",
        "revoked_at": "number: Unix seconds (nullable when not reached)"
      }
    },
    "oauth_states": {
      "keys": [
        "state"
      ],
      "defaults": {},
      "fields": [
        "state",
        "binding",
        "verifier",
        "session_token",
        "expires",
        "mode"
      ],
      "types": {
        "state": "string",
        "binding": "string",
        "verifier": "string",
        "session_token": "string",
        "expires": "number: Unix seconds (nullable when not reached)",
        "mode": "string"
      }
    },
    "oauth_identities": {
      "keys": [
        "provider",
        "subject"
      ],
      "defaults": {},
      "fields": [
        "provider",
        "subject",
        "user_id"
      ],
      "types": {
        "provider": "string",
        "subject": "string",
        "user_id": "number: integer ID/value; optional references may be null"
      }
    },
    "service_policies": {
      "keys": [
        "service_id",
        "priority"
      ],
      "defaults": {},
      "fields": [
        "service_id",
        "priority",
        "response_minutes",
        "resolution_minutes"
      ],
      "types": {
        "service_id": "number: integer ID/value; optional references may be null",
        "priority": "enum: P1 | P2 | P3 | P4",
        "response_minutes": "number: integer ID/value; optional references may be null",
        "resolution_minutes": "number: integer ID/value; optional references may be null"
      }
    },
    "category_aliases": {
      "keys": [
        "alias"
      ],
      "defaults": {},
      "fields": [
        "alias",
        "category"
      ],
      "types": {
        "alias": "string",
        "category": "string"
      }
    },
    "sla_events": {
      "keys": [
        "incident_id",
        "kind"
      ],
      "defaults": {},
      "fields": [
        "incident_id",
        "kind",
        "created_at",
        "deadline",
        "priority"
      ],
      "types": {
        "incident_id": "number: integer ID/value; optional references may be null",
        "kind": "string",
        "created_at": "number: Unix seconds (nullable when not reached)",
        "deadline": "number: Unix seconds (nullable when not reached)",
        "priority": "enum: P1 | P2 | P3 | P4"
      }
    }
  },
  "indexes": [
    {
      "collection": "notifications",
      "key": {
        "user_id": 1,
        "id": -1
      },
      "options": {}
    },
    {
      "collection": "password_resets",
      "key": {
        "user_id": 1,
        "created_at": -1
      },
      "options": {}
    },
    {
      "collection": "users",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "components",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "service_components",
      "key": {
        "service_id": 1,
        "component_id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "rate_limits",
      "key": {
        "key": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "services",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "categories",
      "key": {
        "name": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "subcategories",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "incident_types",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "attachments",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "support_requests",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "policies",
      "key": {
        "priority": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "settings",
      "key": {
        "key": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "incidents",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "notes",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "audit",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "notifications",
      "key": {
        "id": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "sessions",
      "key": {
        "token": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "password_resets",
      "key": {
        "token_hash": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "oauth_states",
      "key": {
        "state": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "oauth_identities",
      "key": {
        "provider": 1,
        "subject": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "service_policies",
      "key": {
        "service_id": 1,
        "priority": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "category_aliases",
      "key": {
        "alias": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "sla_events",
      "key": {
        "incident_id": 1,
        "kind": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "users",
      "key": {
        "email": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "services",
      "key": {
        "name": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "incidents",
      "key": {
        "reporter_id": 1,
        "created_at": -1
      },
      "options": {}
    },
    {
      "collection": "incidents",
      "key": {
        "technician_id": 1,
        "status": 1
      },
      "options": {}
    },
    {
      "collection": "audit",
      "key": {
        "incident_id": 1,
        "id": -1
      },
      "options": {}
    },
    {
      "collection": "sessions",
      "key": {
        "expires": 1
      },
      "options": {}
    },
    {
      "collection": "subcategories",
      "key": {
        "category": 1,
        "name": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "incident_types",
      "key": {
        "subcategory_id": 1,
        "name": 1
      },
      "options": {
        "unique": true
      }
    },
    {
      "collection": "incidents",
      "key": {
        "reporter_id": 1,
        "updated_at": -1
      },
      "options": {}
    },
    {
      "collection": "incidents",
      "key": {
        "reporter_id": 1,
        "request_key": 1
      },
      "options": {
        "unique": true,
        "partialFilterExpression": {
          "request_key": {
            "$type": "string"
          }
        }
      }
    },
    {
      "collection": "attachments",
      "key": {
        "incident_id": 1,
        "created_at": 1
      },
      "options": {}
    },
    {
      "collection": "support_requests",
      "key": {
        "incident_id": 1,
        "status": 1
      },
      "options": {}
    },
    {
      "collection": "notes",
      "key": {
        "support_request_id": 1
      },
      "options": {
        "unique": true,
        "partialFilterExpression": {
          "support_request_id": {
            "$type": "number"
          }
        }
      }
    },
    {
      "collection": "audit",
      "key": {
        "created_at": -1,
        "id": -1
      },
      "options": {}
    },
    {
      "collection": "audit",
      "key": {
        "user_id": 1,
        "created_at": -1
      },
      "options": {}
    },
    {
      "collection": "sla_events",
      "key": {
        "created_at": -1
      },
      "options": {}
    },
    {
      "collection": "notes",
      "key": {
        "incident_id": 1,
        "created_at": -1
      },
      "options": {}
    }
  ],
  "roleAliases": {
    "employee": "employee",
    "technician": "technician",
    "support_engineer": "technician",
    "admin": "admin",
    "administrator": "admin",
    "it_manager": "admin"
  },
  "references": [
    [
      "service_components",
      "service_id",
      "services",
      "id",
      false
    ],
    [
      "service_components",
      "component_id",
      "components",
      "id",
      false
    ],
    [
      "password_resets",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "incidents",
      "reporter_id",
      "users",
      "id",
      false
    ],
    [
      "incidents",
      "technician_id",
      "users",
      "id",
      true
    ],
    [
      "incidents",
      "service_id",
      "services",
      "id",
      false
    ],
    [
      "incidents",
      "category",
      "categories",
      "name",
      false
    ],
    [
      "incidents",
      "duplicate_of",
      "incidents",
      "id",
      true
    ],
    [
      "incidents",
      "incident_type_id",
      "incident_types",
      "id",
      true
    ],
    [
      "subcategories",
      "category",
      "categories",
      "name",
      false
    ],
    [
      "incident_types",
      "subcategory_id",
      "subcategories",
      "id",
      false
    ],
    [
      "incident_types",
      "service_id",
      "services",
      "id",
      false
    ],
    [
      "notes",
      "incident_id",
      "incidents",
      "id",
      false
    ],
    [
      "notes",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "notes",
      "support_request_id",
      "support_requests",
      "id",
      true
    ],
    [
      "support_requests",
      "incident_id",
      "incidents",
      "id",
      false
    ],
    [
      "support_requests",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "attachments",
      "incident_id",
      "incidents",
      "id",
      false
    ],
    [
      "attachments",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "audit",
      "incident_id",
      "incidents",
      "id",
      true
    ],
    [
      "audit",
      "user_id",
      "users",
      "id",
      true
    ],
    [
      "notifications",
      "incident_id",
      "incidents",
      "id",
      true
    ],
    [
      "notifications",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "sla_events",
      "incident_id",
      "incidents",
      "id",
      false
    ],
    [
      "sessions",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "oauth_identities",
      "user_id",
      "users",
      "id",
      false
    ],
    [
      "service_policies",
      "service_id",
      "services",
      "id",
      false
    ],
    [
      "category_aliases",
      "category",
      "categories",
      "name",
      false
    ]
  ],
  "baseline": {
    "categories": [
      "Application",
      "Authentication",
      "Network",
      "Hardware",
      "Database",
      "Cloud",
      "Security",
      "Storage"
    ],
    "services": [
      [
        "Payment Platform",
        3
      ],
      [
        "Corporate Network",
        3
      ],
      [
        "Employee Portal",
        2
      ],
      [
        "Cloud Storage",
        2
      ],
      [
        "Office Devices",
        1
      ]
    ],
    "policies": [
      [
        "P1",
        5,
        30
      ],
      [
        "P2",
        15,
        120
      ],
      [
        "P3",
        60,
        480
      ],
      [
        "P4",
        240,
        1440
      ]
    ]
  },
  "catalog": [
    [
      "Hardware",
      "Laptop",
      "Battery issue",
      "The laptop battery is not charging or is discharging abnormally.",
      "Office Devices"
    ],
    [
      "Hardware",
      "Laptop",
      "Device will not start",
      "The laptop does not start or complete its startup sequence.",
      "Office Devices"
    ],
    [
      "Hardware",
      "Printer",
      "Printing failure",
      "The printer is unable to complete a submitted print job.",
      "Office Devices"
    ],
    [
      "Hardware",
      "Display",
      "Display malfunction",
      "The monitor displays no image or an incorrect image.",
      "Office Devices"
    ],
    [
      "Network",
      "Connectivity",
      "Connection unavailable",
      "The device cannot connect to the corporate network.",
      "Corporate Network"
    ],
    [
      "Network",
      "Remote access",
      "VPN disconnects",
      "The VPN connection cannot be established or disconnects unexpectedly.",
      "Corporate Network"
    ],
    [
      "Network",
      "Connectivity",
      "Slow network",
      "Network communication is slower than expected.",
      "Corporate Network"
    ],
    [
      "Application",
      "Employee applications",
      "Application error",
      "The application displays an error or stops responding during use.",
      "Employee Portal"
    ],
    [
      "Application",
      "Employee applications",
      "Missing functionality",
      "An expected application function cannot be accessed or completed.",
      "Employee Portal"
    ],
    [
      "Application",
      "Payments",
      "Transaction failure",
      "A payment transaction cannot be completed successfully.",
      "Payment Platform"
    ],
    [
      "Authentication",
      "Account access",
      "Sign-in failure",
      "A valid user account cannot sign in to the service.",
      "Employee Portal"
    ],
    [
      "Authentication",
      "Account access",
      "Password recovery failure",
      "The account password cannot be recovered through the recovery process.",
      "Employee Portal"
    ],
    [
      "Database",
      "Data access",
      "Data unavailable",
      "Expected records cannot be retrieved from the database service.",
      "Payment Platform"
    ],
    [
      "Database",
      "Data access",
      "Slow data retrieval",
      "Database requests take an unusually long time to complete.",
      "Payment Platform"
    ],
    [
      "Cloud",
      "Cloud services",
      "Service unavailable",
      "The hosted cloud service cannot be accessed.",
      "Cloud Storage"
    ],
    [
      "Storage",
      "Files and backup",
      "Storage capacity reached",
      "The available storage capacity is insufficient to save new data.",
      "Cloud Storage"
    ],
    [
      "Storage",
      "Files and backup",
      "File synchronization failure",
      "Files are not synchronizing successfully between supported devices.",
      "Cloud Storage"
    ],
    [
      "Security",
      "Suspicious activity",
      "Suspicious message or activity",
      "A suspicious message or unexpected account activity requires investigation.",
      "Employee Portal"
    ]
  ],
  "timestamps": "Unix seconds",
  "storageIds": "Numeric id or declared primary/compound key; references use numeric id, not ObjectId.",
  "internalCollections": {
    "_meta": {
      "keys": [
        "_id"
      ],
      "fields": [
        "_id",
        "revision"
      ],
      "workspaceLockId": "workspace"
    }
  },
  "credentials": "Existing password hashes/OAuth links are preserved; no account passwords or secrets are seeded by this export."
};
  function target(name) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name) || ['admin', 'local', 'config'].includes(name.toLowerCase())) {
      throw new Error('Choose an application database, not a MongoDB system database.');
    }
    return db.getSiblingDB(name);
  }
  async function preview(name = 'relay') {
    const database = target(name);
    const names = await database.getCollectionNames();
    const counts = {};
    for (const table of Object.keys(schema.collections))
      counts[table] = names.includes(table) ? await database.getCollection(table).countDocuments({}) : 0;
    const result = {
      database: name,
      version: schema.version,
      missingCollections: Object.keys(schema.collections).filter(table => !names.includes(table)),
      counts,
      readOnly: true
    };
    print(JSON.stringify(result, null, 2));
    return result;
  }
  async function upgradeData(database) {
    const state = {};
    const inserted = new Set();
    const changed = new Map();
    for (const table of Object.keys(schema.collections))
      state[table] = await database.getCollection(table).find({}).toArray();
    const value = (row, field) => row[field] && typeof row[field] === 'object' && ['Int32', 'Long', 'Double'].includes(row[field]._bsontype) ? Number(row[field]) : row[field];
    const key = (table, row) => schema.collections[table].keys.length === 1 ? value(row, schema.collections[table].keys[0]) : JSON.stringify(schema.collections[table].keys.map(field => value(row, field)));
    function patch(table, row, values) {
      const patchKey = table + '|' + String(key(table, row));
      const entry = changed.get(patchKey) || {
        table,
        row,
        values: {}
      };
      for (const [field, value] of Object.entries(values))
        if (JSON.stringify(row[field]) !== JSON.stringify(value)) {
          row[field] = value;
          entry.values[field] = value;
        }
      if (Object.keys(entry.values).length) {
        changed.set(patchKey, entry);
      }
    }
    function insert(table, values) {
      const row = {
        ...schema.collections[table].defaults,
        ...values
      };
      if (schema.collections[table].keys.length === 1 && schema.collections[table].keys[0] === 'id') {
        row.id = state[table].reduce((max, item) => Math.max(max, item.id), 0) + 1;
      }
      row._id = key(table, row);
      state[table].push(row);
      inserted.add(row);
      return row;
    }
    if (!state.settings.some(row => row.key === 'baseline_v1')) {
      for (const name of schema.baseline.categories)
        if (!state.categories.some(row => row.name === name) && !state.category_aliases.some(row => row.alias === name)) {
          insert('categories', { name });
        }
      if (!state.services.length) {
        for (const [name, criticality] of schema.baseline.services)
          insert('services', {
            name,
            criticality
          });
      }
      for (const [priority, response_minutes, resolution_minutes] of schema.baseline.policies)
        if (!state.policies.some(row => row.priority === priority)) {
          insert('policies', {
            priority,
            response_minutes,
            resolution_minutes
          });
        }
      if (!state.settings.some(row => row.key === 'strategy')) {
        insert('settings', {
          key: 'strategy',
          value: 'skill'
        });
      }
      insert('settings', {
        key: 'baseline_v1',
        value: '1'
      });
    }
    if (!state.settings.some(row => row.key === 'schema_version' && row.value === schema.version)) {
      for (const [table, definition] of Object.entries(schema.collections))
        for (const row of state[table])
          patch(table, row, Object.fromEntries(Object.entries(definition.defaults).filter(([field]) => row[field] === undefined)));
      for (const user of state.users) {
        const role = schema.roleAliases[String(user.role).trim().toLowerCase().replace(/[\s/-]+/g, '_')];
        if (!role) {
          throw new Error('Unknown users.role; review the role field before applying. Existing records are preserved.');
        }
        patch('users', user, {
          role,
          skills: Array.isArray(user.skills) ? user.skills.join(',') : user.skills,
          active: typeof user.active === 'boolean' ? Number(user.active) : user.active,
          available: typeof user.available === 'boolean' ? Number(user.available) : user.available
        });
      }
      for (const table of ['subcategories', 'incident_types'])
        for (const row of state[table])
          if ([0, 1].includes(row.active)) {
            patch(table, row, { active: Boolean(row.active) });
          }
      for (const row of state.notifications)
        if (typeof row.is_read === 'boolean') {
          patch('notifications', row, { is_read: Number(row.is_read) });
        }
      const version = state.settings.find(row => row.key === 'schema_version');
      const values = {
        key: 'schema_version',
        value: schema.version,
        applied_at: Date.now() / 1000
      };
      if (version) {
        patch('settings', version, values);
      }
      else {
        insert('settings', values);
      }
    }
    if (!state.settings.some(row => row.key === 'employee_catalog_v1')) {
      for (const [category, subcategory, name, objective_description, serviceName] of schema.catalog) {
        const current = state.categories.find(row => row.name === category)?.name || state.category_aliases.find(row => row.alias === category)?.category;
        if (!current || !state.services.length) {
          continue;
        }
        const timestamp = Date.now() / 1000;
        const sub = state.subcategories.find(row => row.category === current && row.name === subcategory) || insert('subcategories', {
          category: current,
          name: subcategory,
          active: true,
          created_at: timestamp,
          updated_at: timestamp
        });
        if (!state.incident_types.some(row => row.subcategory_id === sub.id && row.name === name)) {
          const service = state.services.find(row => row.name === serviceName) || state.services[0];
          insert('incident_types', {
            subcategory_id: sub.id,
            name,
            objective_description,
            service_id: service.id,
            active: true,
            created_at: timestamp,
            updated_at: timestamp
          });
        }
      }
      if (state.services.length) {
        insert('settings', {
          key: 'employee_catalog_v1',
          value: '1'
        });
      }
    }
    // References and existing storage IDs are checked before any data changes.
    for (const [table, rows] of Object.entries(state))
      for (const row of rows) {
        if (schema.collections[table].keys.includes('id') && (typeof value(row, 'id') !== 'number' || !Number.isSafeInteger(value(row, 'id')) || value(row, 'id') < 1)) {
          throw new Error('A positive numeric id is required in ' + table + '; no identifiers were guessed.');
        }
        if (key(table, row) === undefined || String(row._id) !== String(key(table, row))) {
          throw new Error('Legacy identifier layout in ' + table + ' needs an explicit import; no identifiers were rewritten.');
        }
        if (table === 'incidents' && !schema.statuses.includes(row.status)) {
          throw new Error('Unknown incident status; review it before upgrading.');
        }
      }
    for (const [table, field, parent, parentField, nullable] of schema.references)
      for (const row of state[table]) {
        if (nullable && row[field] == null) {
          continue;
        }
        const equals = (a, b) => typeof a === 'string' || typeof b === 'string' ? a === b : String(a) === String(b);
        if (!state[parent].some(record => equals(record[parentField], row[field]))) {
          throw new Error('Missing reference ' + table + '.' + field + '; existing data was not replaced.');
        }
      }
    for (const [table, rows] of Object.entries(state))
      for (const row of rows)
        if (inserted.has(row)) {
          await database.getCollection(table).insertOne(row);
        }
    for (const { table, row, values } of changed.values())
      if (!inserted.has(row)) {
        await database.getCollection(table).updateOne({ _id: row._id }, { $set: values });
      }
    return {
      createdRecords: inserted.size,
      updatedRecords: [...changed.values()].filter(entry => !inserted.has(entry.row)).length
    };
  }
  async function apply(name = 'relay') {
    const database = target(name);
    const hello = await database.runCommand({ hello: 1 });
    if (!hello.setName && !hello.msg?.includes('isdbgrid')) {
      throw new Error('A replica set is required. Existing data was not changed.');
    }
    const names = await database.getCollectionNames();
    for (const table of [...Object.keys(schema.collections), '_meta'])
      if (!names.includes(table)) {
        await database.createCollection(table);
      }
    // DDL is additive and occurs outside the data transaction.
    for (const { collection, key, options } of schema.indexes)
      await database.getCollection(collection).createIndex(key, options);
    await database.getCollection('_meta').updateOne({ _id: 'workspace' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    const session = database.getMongo().startSession({ readPreference: { mode: 'primary' } });
    let counts;
    try {
      await session.withTransaction(async () => {
        const transaction = session.getDatabase(name);
        await transaction.getCollection('_meta').updateOne({ _id: 'workspace' }, { $inc: { revision: 1 } });
        counts = await upgradeData(transaction);
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
    }
    finally {
      await session.endSession();
    }
    const result = {
      database: name,
      version: schema.version,
      ...counts,
      preservedAccounts: true,
      deletedRecords: 0
    };
    print(JSON.stringify(result, null, 2));
    return result;
  }
  return {
    version: schema.version,
    preview,
    apply
  };
})();
print('Relay schema loaded. Run relaySchema.preview("relay"), then relaySchema.apply("relay").');
