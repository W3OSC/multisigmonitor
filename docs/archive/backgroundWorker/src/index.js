// Entry point for the background worker
const cron = require('node-cron');
const { initializeEmailClient } = require('./config/email');
const transactionProcessorService = require('./services/transactionProcessorService');

// Initialize email client
initializeEmailClient();

console.log('Starting Safe monitoring service...');

// Run immediately on startup
transactionProcessorService.processAllMonitors();

// Schedule the task to run every minute
console.log('Setting up cron schedule for every minute');
cron.schedule('* * * * *', () => {
  transactionProcessorService.processAllMonitors();
});
