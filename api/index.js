const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is healthy' });
});

// Start the server
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
