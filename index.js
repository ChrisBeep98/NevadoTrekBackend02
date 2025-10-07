// This file is kept for local development compatibility.
// On Vercel, API routes in the /api folder are automatically handled.
// This Express server allows you to run the backend locally during development.

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Redirect to API routes for Vercel compatibility
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API routes are handled by Vercel serverless functions. See /api folder.' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Fallback route
app.get('*', (req, res) => {
  res.status(200).json({ 
    message: 'Welcome to Nevado Trek Backend API',
    documentation: 'See /api folder for available endpoints',
    status: 'running'
  });
});

// Start server for local development
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('API routes are implemented as Vercel serverless functions in the /api folder');
});

module.exports = app;