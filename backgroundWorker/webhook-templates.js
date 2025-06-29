// webhook-templates.js
// Templates for webhook payloads (Discord, Slack, and generic webhooks)

/**
 * Generate a Discord webhook payload for a transaction notification
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
 * @param {string} txInfo.multisigmonitorLink Link to view transaction in Safe Monitor
 * @param {string} txInfo.etherscanLink Link to view transaction on Etherscan (optional)
 * @returns {Object} Discord webhook payload
 */
function generateDiscordWebhook(txInfo) {
  // Set color based on transaction type
  // Discord colors are decimal representation of hex colors
  let color;
  if (txInfo.type === 'suspicious') {
    color = 16724719; // Red for suspicious - #FF6B6B
  } else {
    color = 4886754; // Blue for normal - #4A86F7
  }

  // Create embed fields
  const fields = [
    {
      name: 'Network',
      value: txInfo.network,
      inline: true,
    },
    {
      name: 'Description',
      value: txInfo.description,
      inline: true,
    }
  ];

  // Add nonce if available
  if (txInfo.nonce !== undefined) {
    fields.push({
      name: 'Nonce',
      value: `${txInfo.nonce}`,
      inline: true,
    });
  }

  // Add status
  fields.push({
    name: 'Status',
    value: txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution',
    inline: true,
  });

  // Add transaction hash
  fields.push({
    name: 'Transaction Hash',
    value: `\`${txInfo.hash.substring(0, 16)}...\``,
    inline: true,
  });

  // Build the main embed
  const embed = {
    title: `${txInfo.type === 'suspicious' ? '⚠️ SUSPICIOUS TRANSACTION' : 'New Transaction'}`,
    color: color,
    description: `A new ${txInfo.type} transaction has been detected on Safe: \`${txInfo.safeAddress.substring(0, 6)}...${txInfo.safeAddress.substring(txInfo.safeAddress.length - 4)}\``,
    fields: fields,
    footer: {
      text: 'Safe Monitor Notification',
    },
    timestamp: new Date().toISOString(),
  };

  // Add action buttons
  const components = [
    {
      type: 1,
      components: []
    }
  ];

  // Add Safe App button
  components[0].components.push({
    type: 2,
    style: 5, // Link style
    label: 'View in Safe App',
    url: txInfo.safeAppLink,
  });

  // Add Safe Monitor button
  components[0].components.push({
    type: 2,
    style: 5, // Link style
    label: 'View in Safe Monitor',
    url: txInfo.multisigmonitorLink,
  });

  // Add Etherscan button if available
  if (txInfo.etherscanLink) {
    components[0].components.push({
      type: 2,
      style: 5, // Link style
      label: 'View on Etherscan',
      url: txInfo.etherscanLink,
    });
  }

  return {
    username: 'Safe Monitor',
    avatar_url: 'https://cryptologos.cc/logos/gnosis-safe-gno-logo.png',
    embeds: [embed],
    components: components
  };
}

/**
 * Generate a Slack webhook payload for a transaction notification
 * 
 * @param {Object} txInfo Transaction information (same as for Discord version)
 * @returns {Object} Slack webhook payload
 */
function generateSlackWebhook(txInfo) {
  // Set color based on transaction type and status
  let color;
  if (txInfo.type === 'suspicious') {
    color = '#FF6B6B'; // Red for suspicious
  } else {
    color = '#4A86F7'; // Blue for normal
  }

  // Create the main block
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${txInfo.type === 'suspicious' ? '⚠️ SUSPICIOUS TRANSACTION' : 'New Transaction'}`,
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `A new ${txInfo.type} transaction has been detected on Safe:\n*${txInfo.safeAddress.substring(0, 6)}...${txInfo.safeAddress.substring(txInfo.safeAddress.length - 4)}*`
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Network:*\n${txInfo.network}`
        },
        {
          type: 'mrkdwn',
          text: `*Description:*\n${txInfo.description}`
        }
      ]
    }
  ];

  // Add second row with more fields
  const secondRowFields = [];
  
  // Add nonce if available
  if (txInfo.nonce !== undefined) {
    secondRowFields.push({
      type: 'mrkdwn',
      text: `*Nonce:*\n${txInfo.nonce}`
    });
  }
  
  // Add status
  secondRowFields.push({
    type: 'mrkdwn',
    text: `*Status:*\n${txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution'}`
  });
  
  // Add second row if we have fields
  if (secondRowFields.length > 0) {
    blocks.push({
      type: 'section',
      fields: secondRowFields
    });
  }
  
  // Add transaction hash
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Transaction Hash:*\n\`${txInfo.hash}\``
    }
  });
  
  // Add view links
  const actions = {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View in Safe App',
          emoji: true
        },
        url: txInfo.safeAppLink
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View in Safe Monitor',
          emoji: true
        },
        url: txInfo.multisigmonitorLink
      }
    ]
  };
  
  // Add Etherscan link if available
  if (txInfo.etherscanLink) {
    actions.elements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View on Etherscan',
        emoji: true
      },
      url: txInfo.etherscanLink
    });
  }
  
  // Add actions block
  blocks.push(actions);
  
  return {
    blocks: blocks,
    attachments: [
      {
        color: color
      }
    ]
  };
}

/**
 * Generate a generic webhook payload for a transaction notification
 * 
 * @param {Object} txInfo Transaction information (same as for other versions)
 * @param {string} safeAddress The full Safe address
 * @param {string} network The network name
 * @returns {Object} Generic webhook payload
 */
function generateGenericWebhook(txInfo, safeAddress, network) {
  const payload = {
    event_type: 'safe_transaction',
    alert_type: txInfo.type,
    safe: {
      address: safeAddress,
      network: network
    },
    transaction: {
      hash: txInfo.hash,
      description: txInfo.description,
      nonce: txInfo.nonce,
      status: txInfo.isExecuted ? 'executed' : 'pending',
      execution_hash: txInfo.isExecuted ? txInfo.executionHash : null
    },
    links: {
      safe_app: txInfo.safeAppLink,
      safe_monitor: txInfo.multisigmonitorLink
    },
    timestamp: new Date().toISOString()
  };
  
  // Add etherscan link if available
  if (txInfo.etherscanLink) {
    payload.links.etherscan = txInfo.etherscanLink;
  }
  
  return payload;
}

module.exports = {
  generateDiscordWebhook,
  generateSlackWebhook,
  generateGenericWebhook
};
