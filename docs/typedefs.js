/**
 * @file docs/typedefs.js
 * @description JSDoc type definitions for Express.js objects to be recognized by JSDoc.
 */

/**
 * @external {Request} https://expressjs.com/en/api.html#req
 * @description The Express Request object.
 * @typedef {object} Express.Request
 */

/**
 * @external {Response} https://expressjs.com/en/api.html#res
 * @description The Express Response object.
 * @typedef {object} Express.Response
 */

/**
 * @external {NextFunction} https://expressjs.com/en/api.html#res
 * @description The Express NextFunction middleware callback.
 * @typedef {function} Express.NextFunction
 */

// You might not need the `import('express')` for the actual code,
// but JSDoc needs a way to resolve these names.
// By defining `Express.Request`, `Express.Response`, `Express.NextFunction`
// with @external, JSDoc will link to the Express docs and understand their usage.