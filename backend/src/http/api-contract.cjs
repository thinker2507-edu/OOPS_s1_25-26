'use strict';
const { TRANSITIONS } = require('../domain/index.cjs');
const ref = name => ({ $ref: '#/components/schemas/' + name });
const json = schema => ({ 'application/json': { schema } });
const object = {
  type: 'object',
  additionalProperties: true
};
const positive = {
  type: 'integer',
  minimum: 1
};
const parameter = (name, schema = { type: 'string' }, location = 'query') => ({
  name,
  in: location,
  required: location === 'path',
  schema
});
const id = parameter('id', positive, 'path');
const csrf = {
  sessionCookie: [],
  csrfToken: []
};
function operation(summary, {
  body,
  result = object,
  public: anonymous = false,
  roles,
  parameters = [],
  status = 200,
  ...extra
} = {}) {
  const response = {
    description: status === 201 ? 'Created' : 'Success',
    content: json(result)
  };
  if (status === 201) {
    response.headers = {
      Location: {
        description: 'Created incident resource',
        schema: { type: 'string' }
      }
    };
  }
  return {
    summary,
    parameters,
    ...(anonymous ? { security: [] } : body ? { security: [csrf] } : {}),
    ...(roles ? { 'x-roles': roles } : {}),
    ...(body ? {
      requestBody: {
        required: true,
        content: json(body)
      }
    } : {}),
    responses: {
      [status]: response,
      default: {
        description: 'Safe error; HTTP status indicates validation, permission, conflict or infrastructure failure.',
        content: json(ref('Error'))
      }
    },
    ...extra
  };
}
const EXPLORER = [
  {
    method: 'GET',
    path: '/api/health',
    label: 'Server health'
  },
  {
    method: 'GET',
    path: '/api/ready',
    label: 'Database readiness'
  },
  {
    method: 'GET',
    path: '/api/catalog',
    label: 'Incident classification catalog'
  },
  {
    method: 'GET',
    path: '/api/incidents',
    label: 'List accessible incidents',
    query: ['q', 'status', 'page', 'per_page']
  },
  {
    method: 'GET',
    path: '/api/incidents/{id}',
    label: 'Incident details and recorded history',
    id: true
  },
  {
    method: 'GET',
    path: '/api/search/incidents',
    label: 'Smart search',
    query: ['q', 'page']
  },
  {
    method: 'GET',
    path: '/api/support-requests',
    label: 'Support requests'
  },
  {
    method: 'GET',
    path: '/api/admin/audit',
    label: 'Audit logs',
    query: ['q', 'page']
  },
  {
    method: 'GET',
    path: '/api/admin/sla',
    label: 'SLA violations'
  },
  {
    method: 'POST',
    path: '/api/incidents',
    label: 'Create an incident',
    body: {
      incident_type_id: null,
      additional_details: '',
      request_key: ''
    }
  },
  {
    method: 'POST',
    path: '/api/incidents/{id}',
    label: 'Append information',
    id: true,
    body: {
      action: 'information',
      body: ''
    }
  }
];
function apiContract(baseUrl = 'http://127.0.0.1:3000') {
  const paths = {
    '/api/health': { get: operation('Node server health', { public: true }) },
    '/api/ready': {
      get: operation('MongoDB readiness (503 when unavailable)', {
        public: true,
        responses: {
          '200': {
            description: 'Database ready',
            content: json(object)
          },
          '503': {
            description: 'Database unavailable; health response with status/database fields',
            content: json(object)
          }
        }
      })
    },
    '/api/auth/config': { get: operation('Whether Google sign-in is configured; no credentials', { public: true }) },
    '/api/login': {
      post: operation('Password login and HttpOnly session cookie', {
        public: true,
        body: ref('Login')
      })
    },
    '/api/register': {
      post: operation('Register an employee', {
        public: true,
        body: ref('Registration'),
        status: 201
      })
    },
    '/api/logout': { post: operation('End the current session', { body: object }) },
    '/api/auth/forgot-password': {
      post: operation('Request password recovery; generic response does not reveal account existence', {
        public: true,
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              maxLength: 200
            }
          }
        },
        description: 'Delivery is asynchronous. Local mode writes a private email file; configured Resend mode sends real email. No reset token is returned.'
      })
    },
    '/api/auth/reset-password': {
      post: operation('Redeem a single-use 30-minute reset token and revoke sessions', {
        public: true,
        body: {
          allOf: [ref('NewPassword'), {
            type: 'object',
            required: ['token'],
            properties: {
              token: {
                type: 'string',
                minLength: 43,
                maxLength: 43,
                writeOnly: true
              }
            }
          }]
        }
      })
    },
    '/api/auth/change-password': {
      post: operation('Change own password using current password; revoke all sessions', {
        body: {
          allOf: [ref('NewPassword'), {
            type: 'object',
            required: ['current_password'],
            properties: {
              current_password: {
                type: 'string',
                format: 'password',
                maxLength: 128,
                writeOnly: true
              }
            }
          }]
        }
      })
    },
    '/api/auth/google/start': {
      post: operation('Begin Google login or linking; PKCE/state binding', {
        public: true,
        body: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['login', 'link']
            }
          }
        },
        description: 'Login is public. Link requires a session and X-CSRF-Token.'
      })
    },
    '/auth/google/callback': {
      get: operation('Google OAuth callback', {
        public: true,
        parameters: [parameter('state'), parameter('code'), parameter('error')],
        responses: { '303': { description: 'Redirect with session cookie on success, or a safe login error on failure.' } }
      })
    },
    '/api/bootstrap': { get: operation('Current user and permission-scoped workspace; includes CSRF token', { description: 'Retain csrf only in the client session; never publish bootstrap responses.' }) },
    '/api/catalog': { get: operation('Database-driven categories, subcategories and incident types') },
    '/api/incidents': {
      get: operation('List permission-scoped incidents without bootstrap side effects', {
        result: ref('IncidentList'),
        parameters: [
          parameter('q', {
            type: 'string',
            maxLength: 200
          }),
          parameter('status', {
            type: 'string',
            enum: Object.keys(TRANSITIONS)
          }),
          parameter('category'),
          parameter('service_id', positive),
          parameter('technician_id', positive),
          parameter('page', {
            ...positive,
            default: 1
          }),
          parameter('per_page', {
            ...positive,
            maximum: 100,
            default: 25
          }),
          parameter('sort', {
            type: 'string',
            enum: ['sla', 'updated', 'newest', 'oldest'],
            default: 'sla'
          })
        ]
      }),
      post: operation('Create, classify and automatically assign an incident; retains classified report if no active technician', {
        body: ref('CreateIncident'),
        result: ref('Incident'),
        status: 201
      })
    },
    '/api/incidents/{id}': {
      delete: operation('Permanently delete incident and dependent records atomically; no deletion tombstone or audit retained', {
        parameters: [id],
        roles: ['admin'],
        body: {
          type: 'object',
          required: ['confirmation'],
          properties: {
            confirmation: {
              type: 'string',
              example: 'INC-0012'
            }
          }
        }
      }),
      get: operation('Incident detail including notes, requests, files and audit', {
        parameters: [id],
        result: ref('IncidentDetail')
      }),
      post: operation('Validated incident action; permissions depend on action', {
        parameters: [id],
        body: ref('IncidentAction'),
        result: ref('IncidentDetail'),
        description: 'Compatibility command endpoint retained for existing clients; employee cannot assign or arbitrarily change status.'
      })
    },
    '/api/attachments/{id}': {
        get: operation('Ownership-checked attachment download or image preview', {
          parameters: [id, parameter('preview', { type: 'string', enum: ['1'], description: 'Set to 1 to view PNG/JPEG images inline; other file types remain download-only.' })],
        responses: {
          '200': {
              description: 'Attachment download or authenticated inline PNG/JPEG preview; actual MIME type varies.',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          },
          default: {
            description: 'Not found or unauthorized',
            content: json(ref('Error'))
          }
        }
      })
    },
    '/api/incidents/{id}/related': {
      get: operation('Separate potential duplicates (TF-IDF cosine >= 0.65, top five) and time-window service/component correlations; permission scoped', {
        parameters: [id],
        roles: ['admin', 'technician'],
        result: {
          type: 'object',
          properties: {
            duplicates: {
              type: 'array',
              items: object
            },
            correlations: {
              type: 'array',
              items: object
            },
            window_minutes: { type: 'integer' }
          }
        }
      })
    },
    '/api/admin/storage': { get: operation('Logical application and attachment storage usage; Atlas console reports physical quota usage', { roles: ['admin'] }) },
    '/api/search/incidents': {
      get: operation('Permission-scoped local fuzzy/synonym search', {
        roles: ['admin', 'technician'],
        parameters: [parameter('q', {
          type: 'string',
          maxLength: 200
        }), parameter('page', positive)]
      })
    },
    '/api/support-requests': { get: operation('Visible pending and answered support questions') },
    '/api/admin': {
      post: operation('Administrator configuration command', {
        roles: ['admin'],
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'strategy',
                'assignment_weights',
                'component',
                'service_components',
                'correlation_window',
                'service',
                'service_update',
                'category',
                'category_rename',
                'subcategory',
                'incident_type',
                'policy',
                'technician',
                'user',
                'user_update',
                'user_password_reset'
              ]
            }
          },
          additionalProperties: true
        },
        description: 'assignment_weights: skills/workload/experience/service fractions, each 0..1 and sum 1. technician: id/available/skills/experience_years (0..80); no capacity. component: optional id, name, description. service_components: service_id, component_ids array. correlation_window: minutes (1..10080). policy recalculates only unfinished milestones of open incidents, using submission time and service overrides. Other fields follow administration forms.'
      })
    },
    '/api/admin/audit': {
      get: operation('Global audit with safe details', {
        roles: ['admin'],
        parameters: [parameter('q'), parameter('page', positive)]
      })
    },
    '/api/admin/sla': { get: operation('Active/historical SLA breaches', { roles: ['admin'] }) },
    '/api/notifications/read': { post: operation('Mark current user notifications read', { body: object }) },
    '/api/notifications': { get: operation('Latest notifications for the signed-in user') },
    '/api/notifications/stream': { get: operation('Authenticated live notification event stream', {
      responses: { '200': { description: 'SSE notifications snapshots and session-ended events; reconnect automatically after disconnection.', content: { 'text/event-stream': { schema: { type: 'string' } } } } }
    }) },
    '/api/system': { get: operation('Local server information', { roles: ['admin'] }) },
    '/api/system/stop': {
      post: operation('Stop this local Node instance', {
        roles: ['admin'],
        body: object
      })
    },
    '/api/openapi.json': { get: operation('Download this API contract', { roles: ['admin'] }) }
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'Relay ITSM REST API',
      version: '3.1.0',
      description: 'Local React/Node/MongoDB API. Same-origin HttpOnly sessions; all authenticated POST requests require X-CSRF-Token from bootstrap. This contract preserves existing command endpoints alongside resource endpoints.'
    },
    servers: [{ url: baseUrl }],
    security: [{ sessionCookie: [] }],
    paths,
    'x-relay-explorer': EXPLORER,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'itsm_session'
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token'
        }
      },
      schemas: {
        NewPassword: {
          type: 'object',
          required: ['new_password', 'confirm_password'],
          properties: {
            new_password: {
              type: 'string',
              minLength: 10,
              maxLength: 128,
              format: 'password',
              writeOnly: true
            },
            confirm_password: {
              type: 'string',
              minLength: 10,
              maxLength: 128,
              format: 'password',
              writeOnly: true
            }
          }
        },
        Error: {
          type: 'object',
          required: ['error', 'code'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string' }
          }
        },
        Login: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email'
            },
            password: {
              type: 'string',
              format: 'password',
              maxLength: 128,
              writeOnly: true
            }
          }
        },
        Registration: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100
            },
            email: {
              type: 'string',
              format: 'email'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 10,
              maxLength: 128,
              writeOnly: true
            }
          }
        },
        AttachmentInput: {
          type: 'object',
          required: ['name', 'data'],
          properties: {
            name: { type: 'string' },
            data: {
              type: 'string',
              format: 'byte',
              description: 'Base64 PNG/JPEG/PDF/text; 2 MB each, up to three files and 4 MB total.'
            }
          }
        },
        CreateIncident: { oneOf: [ref('CatalogIncident'), ref('LegacyIncident')] },
        CatalogIncident: {
          type: 'object',
          required: ['incident_type_id', 'request_key'],
          properties: {
            incident_type_id: positive,
            additional_details: {
              type: 'string',
              maxLength: 10000
            },
            request_key: {
              type: 'string',
              minLength: 16,
              maxLength: 100,
              description: 'Unique submission key. Reuse with identical body for retries.'
            },
            attachments: {
              type: 'array',
              maxItems: 3,
              items: ref('AttachmentInput')
            }
          }
        },
        LegacyIncident: {
          type: 'object',
          required: ['title', 'description', 'service_id'],
          not: { required: ['incident_type_id'] },
          properties: {
            title: {
              type: 'string',
              minLength: 5,
              maxLength: 160
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 12000
            },
            service_id: positive,
            category: {
              type: 'string',
              default: 'auto'
            },
            impact: {
              type: 'integer',
              minimum: 1,
              maximum: 3,
              default: 1
            },
            urgency: {
              type: 'integer',
              minimum: 1,
              maximum: 3,
              default: 2
            },
            affected: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              default: 1
            },
            attachments: {
              type: 'array',
              maxItems: 3,
              items: ref('AttachmentInput')
            }
          },
          description: 'Compatibility format for existing free-text clients.'
        },
        IncidentAction: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'information',
                'note',
                'investigation',
                'support_request',
                'support_response',
                'status',
                'assign',
                'auto_assign',
                'edit',
                'category',
                'feedback'
              ]
            },
            body: { type: 'string' },
            status: {
              type: 'string',
              enum: Object.keys(TRANSITIONS)
            },
            technician_id: positive,
            request_id: positive,
            resolution: { type: 'string' },
            attachments: {
              type: 'array',
              maxItems: 3,
              items: ref('AttachmentInput')
            }
          },
          additionalProperties: true
        },
        Incident: {
          type: 'object',
          required: ['id', 'title', 'status', 'reporter_id'],
          properties: {
            id: positive,
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: Object.keys(TRANSITIONS)
            },
            reporter_id: positive,
            service_id: positive,
            technician_id: {
              ...positive,
              nullable: true
            },
            created_at: {
              type: 'number',
              description: 'Unix seconds'
            },
            updated_at: {
              type: 'number',
              description: 'Unix seconds'
            }
          },
          additionalProperties: true
        },
        IncidentDetail: {
          allOf: [ref('Incident'), {
            type: 'object',
            properties: {
              notes: {
                type: 'array',
                items: object
              },
              audit: {
                type: 'array',
                items: object
              },
              support_requests: {
                type: 'array',
                items: object
              },
              attachments: {
                type: 'array',
                items: object
              }
            }
          }]
        },
        IncidentList: {
          type: 'object',
          required: [
            'incidents',
            'total',
            'page',
            'per_page',
            'pages'
          ],
          properties: {
            incidents: {
              type: 'array',
              items: ref('Incident')
            },
            total: {
              type: 'integer',
              minimum: 0
            },
            page: positive,
            per_page: {
              ...positive,
              maximum: 100
            },
            pages: {
              type: 'integer',
              minimum: 0
            }
          }
        }
      }
    }
  };
}
module.exports = { apiContract };
