// index.js
const cron = require('node-cron');
const axios = require('axios');
const { exec } = require('child_process');
const supabase = require('./supabase');
require('dotenv').config();

async function checkTransactions() {
  console.log('Checking transactions...');

//   const { data: monitors, error } = await supabase.from('monitors').select('id, user_id, transaction_string, notify');

//   if (error) {
//     console.error('Error fetching monitors:', error);
//     return;
//   }

//   for (const monitor of monitors) {
//     try {
//       const response = await axios.get(`${process.env.EXTERNAL_API_URL}?query=${encodeURIComponent(monitor.transaction_string)}`);

//       if (response.data.hasNewTransaction) {
//         console.log(`New transaction found for monitor ID ${monitor.id}`);

//         // Execute Docker container (example command)
//         const dockerCmd = `docker run --rm your-image-name process-transaction "${monitor.transaction_string}"`;
//         exec(dockerCmd, async (error, stdout, stderr) => {
//           if (error) {
//             console.error('Docker error:', error);
//             return;
//           }

//           const resultData = stdout; // Replace with actual output handling

//           // Save result back to Supabase
//           const { error: dbError } = await supabase.from('transactions').insert({
//             monitor_id: monitor.id,
//             user_id: monitor.user_id,
//             result: resultData,
//             checked_at: new Date(),
//           });

//           if (dbError) {
//             console.error('DB error:', dbError);
//             return;
//           }

//           // Send notification
//           if (monitor.notify) {
//             await axios.post(process.env.NOTIFICATION_WEBHOOK_URL, {
//               userId: monitor.user_id,
//               message: `New transaction detected: ${monitor.transaction_string}`,
//             });
//           }
//         });
//       } else {
//         console.log(`No new transactions for monitor ID ${monitor.id}`);
//       }
//     } catch (apiError) {
//       console.error('External API error:', apiError.message);
//     }
//   }
}

// Schedule the task to run every minute
cron.schedule('* * * * *', checkTransactions);
