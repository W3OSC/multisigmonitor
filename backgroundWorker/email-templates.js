// email-templates.js
// HTML email templates for transaction notifications

/**
 * Generate an HTML email for a transaction notification
 * 
 * @param {Object} txInfo Transaction information
 * @param {string} txInfo.safeAddress Safe address
 * @param {string} txInfo.network Network name
 * @param {string} txInfo.type Transaction type ('normal' or 'suspicious')
 * @param {string} txInfo.description Transaction description
 * @param {string} txInfo.hash Transaction hash
 * @param {string|number} txInfo.nonce Transaction nonce (optional)
 * @param {boolean} txInfo.isExecuted Whether the transaction has been executed
 * @param {string} txInfo.safeAppLink Link to view transaction in Safe App
 * @param {string} txInfo.safeMonitorLink Link to view transaction in Safe Monitor
 * @param {string} txInfo.etherscanLink Link to view transaction on Etherscan (optional)
 * @param {boolean} txInfo.isTest Whether this is a test notification
 * @returns {string} HTML email content
 */
function generateTransactionEmailHtml(txInfo) {
  const isTestLabel = txInfo.isTest ? '[TEST] ' : '';
  const suspiciousClass = txInfo.type === 'suspicious' ? 'suspicious' : 'normal';
  const suspiciousLabel = txInfo.type === 'suspicious' ? '⚠️ SUSPICIOUS ' : '';
  const statusLabel = txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution';
  const truncatedSafe = `${txInfo.safeAddress.substring(0, 6)}...${txInfo.safeAddress.substring(txInfo.safeAddress.length - 4)}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTestLabel}${suspiciousLabel}Safe Transaction Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 20px;
      margin: 0;
      background-color: #f9f9f9;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #fff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }
    .header {
      background-color: ${txInfo.type === 'suspicious' ? '#ff6b6b' : '#4dabf7'};
      color: white;
      padding: 20px;
      text-align: center;
    }
    .content {
      padding: 20px;
    }
    .transaction-details {
      background-color: #f5f5f5;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    .detail-label {
      font-weight: bold;
      color: #555;
    }
    .links {
      margin-top: 25px;
    }
    .btn {
      display: inline-block;
      padding: 10px 15px;
      background-color: #4dabf7;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-right: 10px;
      margin-bottom: 10px;
    }
    .btn.safe {
      background-color: #12FF80;
      color: #121312;
    }
    .btn.etherscan {
      background-color:rgb(249, 126, 255);
    }
    .btn.monitor {
      background-color:rgb(130, 159, 255);
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
    .test-banner {
      background-color: #ff9800;
      color: white;
      text-align: center;
      padding: 8px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    ${txInfo.isTest ? '<div class="test-banner">THIS IS A TEST NOTIFICATION</div>' : ''}
    <div class="header">
      <h1>🔔 ${suspiciousLabel}Transaction Alert</h1>
    </div>
    <div class="content">
      <p>A new ${txInfo.type} transaction has been detected for your monitored Safe:</p>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Network:</span>
          <span>${txInfo.network}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Safe Address:</span>
          <span>${truncatedSafe}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <span>${txInfo.description}</span>
        </div>
        ${txInfo.nonce !== undefined ? `
        <div class="detail-row">
          <span class="detail-label">Nonce:</span>
          <span>${txInfo.nonce}</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span>${statusLabel}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction Hash:</span>
          <span style="word-break: break-all;">${txInfo.hash}</span>
        </div>
      </div>
      
      <div class="links">
        <p><strong>View this transaction:</strong></p>
        <a href="${txInfo.safeAppLink}" class="btn safe" target="_blank">Safe App</a>
        <a href="${txInfo.safeMonitorLink}" class="btn monitor" target="_blank">Safe Monitor</a>
        ${txInfo.etherscanLink ? `<a href="${txInfo.etherscanLink}" class="btn etherscan" target="_blank">Etherscan</a>` : ''}
      </div>
    </div>
    <div class="footer">
      <p>You are receiving this email because you have set up notifications for this Safe address.</p>
      <p>© ${new Date().getFullYear()} Safe Monitor</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate a plain text email for a transaction notification
 * Used as fallback for email clients that don't support HTML
 * 
 * @param {Object} txInfo Transaction information (same as for HTML version)
 * @returns {string} Plain text email content
 */
function generateTransactionEmailText(txInfo) {
  const isTestLabel = txInfo.isTest ? '[TEST] ' : '';
  const suspiciousLabel = txInfo.type === 'suspicious' ? '⚠️ SUSPICIOUS ' : '';
  const statusLabel = txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution';

  let text = `
${isTestLabel}${suspiciousLabel}SAFE TRANSACTION ALERT

A new ${txInfo.type} transaction has been detected for your monitored Safe:

TRANSACTION DETAILS:
-------------------
Network: ${txInfo.network}
Safe Address: ${txInfo.safeAddress}
Description: ${txInfo.description}
${txInfo.nonce !== undefined ? `Nonce: ${txInfo.nonce}\n` : ''}Status: ${statusLabel}
Transaction Hash: ${txInfo.hash}

VIEW TRANSACTION:
----------------
Safe App: ${txInfo.safeAppLink}
Safe Monitor: ${txInfo.safeMonitorLink}
${txInfo.etherscanLink ? `Etherscan: ${txInfo.etherscanLink}` : ''}

${txInfo.isTest ? 'THIS IS A TEST NOTIFICATION\n' : ''}
You are receiving this email because you have set up notifications for this Safe address.
`;

  return text;
}

module.exports = {
  generateTransactionEmailHtml,
  generateTransactionEmailText
};
