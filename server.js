/**
 * @file server.js
 * @description Server startup file.
 * @author Your Name
 */

import app from './app.js';
import { bridge } from './bridge.js';
import dotenv from 'dotenv';

// Load environment variables (in case app.js didn't load them early enough for bridge.js)
dotenv.config();

const PORT = process.env.PORT || bridge.SERVER_PORT || 8000;

// Start the server
app.listen(PORT, () => {
    console.log(`\n✨ Server is ready and listening on port: ${PORT}`);
    console.log(`   Local:            ${bridge.BASE_URL}`);
    // Add any other relevant URLs, e.g., if you have a different public URL
    console.log(`   Frontend URL:     ${bridge.FRONTEND_URL}`);
    console.log(`   Environment:      ${bridge.NODE_ENV}`);
    console.log(`   Press CTRL+C to stop`);
});