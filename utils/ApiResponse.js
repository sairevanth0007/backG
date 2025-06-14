/**
 * @file utils/ApiResponse.js
 * @description Class for standardizing API responses.
 * @author GIDE
 */

/**
 * @class ApiResponse
 * @description Represents a standardized API response.
 *
 * @param {number} statusCode - HTTP status code for the response.
 * @param {*} data - Data payload of the response.
 * @param {string} message - Response message, defaults to "Success".
 */
class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400; // Success is true if statusCode is less than 400
    }
}

export { ApiResponse };