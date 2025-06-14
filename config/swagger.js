/**
 * @file config/swagger.js
 * @description Configuration for Swagger API documentation using JSDoc comments.
 * @author Your Name
 */

import { bridge } from '../bridge.js';

const swaggerDefinition = {
    openapi: '3.0.0', // Specify OpenAPI version
    info: {
        title: 'My Backend API',
        version: '1.0.0',
        description: 'A robust backend for subscription management, OAuth authentication, and referral system.',
        contact: {
            name: 'Your Name',
            email: 'your.email@example.com',
            url: 'https://yourwebsite.com',
        },
    },
    servers: [
        {
            url: `${bridge.BASE_URL}/api/v1`,
            description: 'Development Server',
        },
        // {
        //     url: 'https://yourproductionapi.com/api/v1',
        //     description: 'Production Server',
        // },
    ],
    components: {
        securitySchemes: {
            // Define security schemes (e.g., for session-based authentication)
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'connect.sid', // Name of the session cookie
                description: 'Session cookie for authentication. Obtained after successful OAuth login.',
            },
            // Add if you use JWT tokens for direct API calls after OAuth
            // bearerAuth: {
            //     type: 'http',
            //     scheme: 'bearer',
            //     bearerFormat: 'JWT',
            //     description: 'JWT authorization header (e.g., "Bearer YOUR_TOKEN").'
            // }
        },
        schemas: {
            ApiResponse: {
                type: 'object',
                properties: {
                    statusCode: { type: 'integer' },
                    data: { type: 'object', nullable: true },
                    message: { type: 'string' },
                    success: { type: 'boolean' },
                },
                example: {
                    statusCode: 200,
                    data: { id: 'someId', name: 'example' },
                    message: 'Success',
                    success: true,
                },
            },
            ApiError: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', default: false },
                    message: { type: 'string' },
                    errors: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                field: { type: 'string', nullable: true },
                                message: { type: 'string' },
                            },
                        },
                        nullable: true,
                    },
                    stack: { type: 'string', nullable: true },
                },
                example: {
                    success: false,
                    message: 'Unauthorized access. Please login.',
                    errors: null,
                    statusCode: 401,
                },
            },
            PlanIdPayload: {
                type: 'object',
                required: ['planId'],
                properties: {
                    planId: {
                        type: 'string',
                        description: 'MongoDB ObjectId of the selected plan',
                        example: '60c72b2f9f1b2c001c8e4d6a'
                    }
                }
            }
        },
    },
};

const swaggerOptions = {
    swaggerDefinition: swaggerDefinition,
    apis: [
        './routes/*.js', // Path to your API routes
        './controllers/*.js', // Path to your controllers if you use JSDoc there for schemas
        './models/*.js', // Path to your models for schema definitions
    ],
};

export default swaggerOptions;