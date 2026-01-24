# Safe Management Transaction Monitoring

This document describes the Safe management transaction monitoring feature in the Safe Watch Jettison Protocol.

## Overview

multisig wallets allow for various management operations that change the configuration of the Safe itself, rather than just transferring assets. These operations include:

- Adding or removing owners
- Changing the threshold (required confirmations)
- Enabling or disabling modules
- Setting guards
- Other Safe configuration changes

Monitoring these management operations is critical for governance security, as they directly affect who controls the Safe.

### Alert Types

The system supports three filtering modes for transaction alerts:

1. **All transactions** - Notifies for every transaction on the Safe (default)
2. **Management and Suspicious transactions only** - Notifies for management operations plus suspicious transactions
3. **Suspicious transactions only** - Notifies only for transactions flagged as suspicious

## Management Transaction Detection

The system identifies management transactions by examining the decoded transaction data. Specifically, it looks for these method signatures:

```javascript
// Owner management
"addOwnerWithThreshold";
"removeOwner";
"swapOwner";
"changeThreshold";

// Module management
"enableModule";
"disableModule";

// Guard management
"setGuard";

// Fallback management
"setFallbackHandler";

// Other Safe management functions
"changeMasterCopy";
"setup";
"execTransactionFromModule";
"execTransactionFromModuleReturnData";
"approveHash";
"setStorageAt";
```

### Use Cases

#### Governance Oversight

For DAOs and organizations using multisigs for treasury management, monitoring management operations is critical. It ensures that no unauthorized changes to the Safe's configuration occur.

#### Security Monitoring

By monitoring management transactions, you can detect and respond to:

- Governance attacks (adding malicious owners)
- Threshold decreases that weaken security
- Module additions that may introduce vulnerabilities
- Unexpected configuration changes

#### Compliance Requirements

Some organizations need to maintain auditable records of all governance changes for compliance or transparency requirements.

### Configuration

To set up management transaction monitoring:

1. Create a new monitor or edit an existing one
2. Enable notifications
3. Choose the appropriate alert type based on your needs:
   - "All transactions" for complete monitoring
   - "Management and Suspicious transactions only" for governance + security focus
   - "Suspicious transactions only" for basic security monitoring

### Notification Methods

All supported notification methods (Email, Telegram, Discord, Slack, Webhook) work with management transaction alerts. Each notification will clearly indicate the type of management operation and its details.

## Contributors

<br>
<table>
<tr>
    <td align="center">
        <a href="https://github.com/fredrik0x">
            <img src="https://avatars.githubusercontent.com/u/84518844?v=4" width="100;" alt="fredrik0x"/>
            <br />
            <sub><b>fredrik0x</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/forefy">
            <img src="https://avatars.githubusercontent.com/u/166978930?v=4" width="100;" alt="forefy"/>
            <br />
            <sub><b>forefy</b></sub>
        </a>
    </td>
</tr>
</table>
<br>

> **📢 Contributing to W3OS**
>
> W3OS is an open standard developed collaboratively by the Web3 security community. Contributions by anyone are welcome.
>
> - 📖 **Read the [Contributing Guide](CONTRIBUTING.md)** for detailed information on how to propose changes, add new sections, and improve existing content
> - 💬 **Join the [Telegram Discussion Group](https://t.me/+yhmMnY2DyNBmNDlh)** to participate in ongoing collaboration and connect with other contributors
>
> _Help build the comprehensive operational security standard for Web3 organizations._
