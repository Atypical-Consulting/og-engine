/**
 * Static OpenAPI 3.1 specification for OG Engine API.
 *
 * We use a hand-written spec rather than auto-generated schemas because
 * @hono/zod-openapi has compatibility issues with Zod v4.
 */
export function createOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'OG Engine API',
      version: '0.1.0',
      description:
        'Headless image generation API powered by server-side text layout. Generate OG images, social cards, email banners, and dynamic visual content without a browser.',
      contact: {
        name: 'OG Engine Support',
        url: 'https://og-engine.com',
      },
      license: {
        name: 'FSL-1.1-MIT',
        url: 'https://fsl.software/',
      },
    },
    servers: [
      {
        url: 'https://api.og-engine.com',
        description: 'Production',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
    paths: {
      '/render': {
        post: {
          operationId: 'renderImage',
          summary: 'Generate an image',
          description:
            'Generate a PNG/WebP image from text + style configuration. Returns the binary image with render metadata in response headers.',
          tags: ['Render'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RenderRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Rendered image',
              headers: {
                'X-Render-Time-Ms': {
                  schema: { type: 'number' },
                  description: 'Total render time in milliseconds',
                },
                'X-Title-Lines': {
                  schema: { type: 'integer' },
                  description: 'Number of lines used by the title',
                },
                'X-Desc-Lines': {
                  schema: { type: 'integer' },
                  description: 'Number of lines used by the description',
                },
                'X-Layout-Overflow': {
                  schema: { type: 'boolean' },
                  description: 'Whether text overflowed its bounding box',
                },
              },
              content: {
                'image/png': { schema: { type: 'string', format: 'binary' } },
                'image/webp': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/validate': {
        post: {
          operationId: 'validateText',
          summary: 'Check if text fits a layout',
          description:
            'Check whether title and description text fit within a given layout without generating an image. Ultra-fast, sub-millisecond response.',
          tags: ['Validate'],
          security: [{ BearerAuth: [] }, {}],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidateRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Validation result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidateResponse' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/render/from-url': {
        post: {
          operationId: 'renderFromUrl',
          summary: 'Render from URL',
          description:
            'Zero-config image generation. Fetches OG meta tags from the given URL and renders a card automatically.',
          tags: ['Render'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RenderFromUrlRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Rendered image',
              content: {
                'image/png': { schema: { type: 'string', format: 'binary' } },
                'image/webp': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/render/batch': {
        post: {
          operationId: 'renderBatch',
          summary: 'Batch render',
          description:
            'Render multiple images in a single request. Requires Pro plan or above. Returns a ZIP archive of images.',
          tags: ['Render'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BatchRenderRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'ZIP archive of rendered images',
              headers: {
                'X-Batch-Count': {
                  schema: { type: 'integer' },
                  description: 'Number of images rendered',
                },
              },
              content: {
                'application/zip': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': {
              description: 'Plan does not support batch rendering',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/health': {
        get: {
          operationId: 'healthCheck',
          summary: 'Health check',
          description: 'Returns service status, available fonts, formats, templates, and version.',
          tags: ['System'],
          security: [],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/auth/register': {
        post: {
          operationId: 'register',
          summary: 'Register for an API key',
          description: 'Register with an email address and receive an API key for authenticating requests.',
          tags: ['Auth'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email', description: 'Your email address' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'API key created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      apiKey: { type: 'string', description: 'Your API key (shown only once)' },
                      email: { type: 'string' },
                      plan: { type: 'string', enum: ['free', 'starter', 'pro', 'scale'] },
                      callsLimit: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
          },
        },
      },
      '/usage': {
        get: {
          operationId: 'getUsage',
          summary: 'Get usage stats',
          description: 'Returns current billing period usage, limits, and remaining quota.',
          tags: ['Account'],
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Usage statistics',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UsageResponse' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/billing/portal': {
        get: {
          operationId: 'billingPortal',
          summary: 'Stripe billing portal',
          description: 'Redirects to the Stripe Customer Portal for managing subscription and payment methods.',
          tags: ['Account'],
          security: [{ BearerAuth: [] }],
          responses: {
            '302': {
              description: 'Redirect to Stripe Customer Portal',
              headers: {
                Location: {
                  schema: { type: 'string', format: 'uri' },
                  description: 'Stripe portal URL',
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key obtained from POST /auth/register. Pass as: Authorization: Bearer <key>',
        },
      },
      schemas: {
        RenderRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            format: {
              type: 'string',
              enum: ['og', 'twitter', 'square', 'linkedin', 'story'],
              default: 'og',
              description: 'Output image format/dimensions',
            },
            template: {
              type: 'string',
              default: 'default',
              description: 'Template name (e.g. default, social-card, blog-hero)',
            },
            title: { type: 'string', description: 'Main heading text' },
            description: { type: 'string', description: 'Secondary body text' },
            author: { type: 'string', description: 'Author name' },
            tag: { type: 'string', description: 'Tag / category label' },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Custom template variables (key-value pairs)',
            },
            images: {
              type: 'object',
              additionalProperties: { type: 'string', format: 'uri' },
              description: 'Named image URLs for template slots (e.g. avatar, logo)',
            },
            style: {
              type: 'object',
              properties: {
                accent: { type: 'string', description: 'Accent color (hex)', default: '#38ef7d' },
                layout: {
                  type: 'string',
                  enum: ['left', 'center', 'right'],
                  default: 'left',
                },
                font: { type: 'string', default: 'Outfit' },
                titleSize: { type: 'integer', default: 48 },
                descSize: { type: 'integer', default: 22 },
                gradient: { type: 'string', description: 'Background gradient preset name' },
                backgroundImage: {
                  type: 'string',
                  format: 'uri',
                  nullable: true,
                  description: 'Background image URL',
                },
                overlayOpacity: { type: 'number', minimum: 0, maximum: 1, default: 0.65 },
              },
            },
            output: {
              type: 'object',
              properties: {
                format: { type: 'string', enum: ['png', 'webp'], default: 'png' },
                quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 },
              },
            },
          },
        },
        ValidateRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            format: { type: 'string', enum: ['og', 'twitter', 'square', 'linkedin', 'story'], default: 'og' },
            title: { type: 'string' },
            description: { type: 'string' },
            font: { type: 'string', default: 'Outfit' },
            titleSize: { type: 'integer', default: 48 },
            descSize: { type: 'integer', default: 22 },
            maxTitleLines: { type: 'integer', default: 3 },
            maxDescLines: { type: 'integer', default: 4 },
          },
        },
        ValidateResponse: {
          type: 'object',
          properties: {
            fits: { type: 'boolean' },
            title: {
              type: 'object',
              properties: {
                lines: { type: 'integer' },
                maxLines: { type: 'integer' },
                overflow: { type: 'boolean' },
              },
            },
            description: {
              type: 'object',
              properties: {
                lines: { type: 'integer' },
                maxLines: { type: 'integer' },
                overflow: { type: 'boolean' },
              },
            },
            computeTimeMs: { type: 'number' },
          },
        },
        RenderFromUrlRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri', description: 'URL to fetch OG tags from' },
            format: { type: 'string', enum: ['og', 'twitter', 'square', 'linkedin', 'story'], default: 'og' },
            style: {
              type: 'object',
              properties: {
                gradient: { type: 'string' },
                accent: { type: 'string' },
              },
            },
            overrides: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                tag: { type: 'string' },
              },
            },
          },
        },
        BatchRenderRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/RenderRequest' },
              maxItems: 50,
              description: 'Array of render requests (max 50)',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            fonts: { type: 'array', items: { type: 'string' } },
            formats: { type: 'array', items: { type: 'string' } },
            templates: { type: 'array', items: { type: 'string' } },
            version: { type: 'string' },
          },
        },
        UsageResponse: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            plan: { type: 'string', enum: ['free', 'starter', 'pro', 'scale'] },
            callsUsed: { type: 'integer' },
            callsLimit: { type: 'integer' },
            callsRemaining: { type: 'integer' },
            periodStart: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string', description: 'Machine-readable error code' },
            message: { type: 'string', description: 'Human-readable error description' },
            docs: { type: 'string', format: 'uri', description: 'Link to error documentation' },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        Unauthorized: {
          description: 'Missing or invalid API key',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': { schema: { type: 'integer' } },
            'X-RateLimit-Remaining': { schema: { type: 'integer' } },
            'X-RateLimit-Reset': { schema: { type: 'integer' } },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Render', description: 'Image generation endpoints' },
      { name: 'Validate', description: 'Text layout validation' },
      { name: 'Auth', description: 'Authentication and API key management' },
      { name: 'Account', description: 'Usage and billing' },
      { name: 'System', description: 'Health and status' },
    ],
  };
}
