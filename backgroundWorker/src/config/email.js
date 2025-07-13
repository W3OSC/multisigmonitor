const { Resend } = require('resend');
require('dotenv').config();

let resend = null;
const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || 'notifications@multisigmonitor.com';

const initializeEmailClient = () => {
  try {
    if (process.env.RESEND_API_KEY) {
      resend = new Resend(process.env.RESEND_API_KEY);
      console.log('Resend library initialized with API key');
    } else {
      console.log('Resend API key not found. Email notifications will be logged but not sent.');
    }
  } catch (err) {
    console.error('Error initializing Resend client:', err.message);
  }
  
  console.log(`Default from email configured as: ${defaultFromEmail}`);
  return resend;
};

module.exports = {
  initializeEmailClient,
  getEmailClient: () => resend,
  defaultFromEmail
};
