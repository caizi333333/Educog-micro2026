/**
 * @fileoverview This file is the entry point for the Genkit development server.
 *
 * To run the server, use the command: `npm run genkit:dev`
 */

// We must import the flows here to register them with the Genkit server.
import './flows/ai-study-assistant';
import './flows/code-simulation-flow';
import './flows/learning-plan-flow';

// We don't need to export anything from this file.
export {};
