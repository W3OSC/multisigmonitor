# Worker Subsystem Deep Dive

> The multi-chain data fetcher and multi-channel notification system

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart TB
    Request([🔍 Fetch Request<br/>Safe Address + Network]) --> Router

    subgraph SafeAPIClient["🌐 Safe API Client"]
        Router{Network<br/>Router}
        
        Router -->|ethereum| ETH[🔷 Ethereum Mainnet<br/>safe-transaction-mainnet<br/>Chain ID: 1]
        Router -->|sepolia| SEP[🧪 Sepolia Testnet<br/>safe-transaction-sepolia<br/>Chain ID: 11155111]
        Router -->|polygon| POL[🟣 Polygon<br/>safe-transaction-polygon<br/>Chain ID: 137]
        Router -->|arbitrum| ARB[🔵 Arbitrum<br/>safe-transaction-arbitrum<br/>Chain ID: 42161]
        
        ETH & SEP & POL & ARB --> API[HTTP GET Request<br/>/api/v1/safes/{address}/multisig-transactions/]
        
        API --> Parse[📦 Parse Response]
        Parse --> Filter[🔍 Filter Pending Txs<br/>isExecuted = false]
        Filter --> Checksum[✓ Validate Checksums]
        Checksum --> TxList
    end

    TxList([📋 Transaction List]) --> Alert

    subgraph NotificationService["📢 Notification Service"]
        Alert[Prepare Alert Message]
        
        Alert --> Build[🎨 Build Alert<br/>• Safe Address<br/>• Network<br/>• Transaction Hash<br/>• Risk Level<br/>• Description<br/>• Nonce]
        
        Build --> Channels{Monitor<br/>Channels}
    end

    Channels -->|email enabled| EmailFlow
    Channels -->|telegram enabled| TelegramFlow
    Channels -->|webhook enabled| WebhookFlow
    Channels -->|discord enabled| DiscordFlow

    subgraph EmailChannel["📧 Email Channel"]
        EmailFlow[Check Resend API Key]
        EmailFlow --> EmailValid{Valid?}
        EmailValid -->|yes| EmailSend[🚀 Send via Resend<br/>POST /emails]
        EmailValid -->|no| EmailSkip[⚠️ Skip - No API Key]
        
        EmailSend --> EmailFormat[📝 HTML Template<br/>• Header with Logo<br/>• Risk Badge<br/>• Transaction Details<br/>• Safe Explorer Link<br/>• Styled for Dark Mode]
    end

    subgraph TelegramChannel["💬 Telegram Channel"]
        TelegramFlow[Get Bot Token + Chat ID]
        TelegramFlow --> TelValid{Valid?}
        TelValid -->|yes| TelSend[🚀 Send via Telegram Bot API<br/>POST /sendMessage]
        TelValid -->|no| TelSkip[⚠️ Skip - Not Configured]
        
        TelSend --> TelFormat[📝 Markdown Message<br/>• Risk Emoji<br/>• Bold Headers<br/>• Code Blocks<br/>• Inline Link]
    end

    subgraph WebhookChannel["🔗 Webhook Channel"]
        WebhookFlow[Get Webhook URL]
        WebhookFlow --> WebValid{Valid?}
        WebValid -->|yes| WebSend[🚀 HTTP POST<br/>JSON Payload]
        WebValid -->|no| WebSkip[⚠️ Skip - No URL]
        
        WebSend --> WebFormat[📦 JSON Structure<br/>• alert_type<br/>• safe_address<br/>• network<br/>• transaction_hash<br/>• risk_level<br/>• timestamp]
    end

    subgraph DiscordChannel["💬 Discord Channel"]
        DiscordFlow[Get Webhook URL]
        DiscordFlow --> DiscValid{Valid?}
        DiscValid -->|yes| DiscSend[🚀 POST to Discord Webhook]
        DiscValid -->|no| DiscSkip[⚠️ Skip - No Webhook]
        
        DiscSend --> DiscFormat[🎨 Rich Embed<br/>• Color by Risk<br/>• Fields Layout<br/>• Timestamp<br/>• Footer with Network]
    end

    EmailFormat --> Done
    EmailSkip --> Done
    TelFormat --> Done
    TelSkip --> Done
    WebFormat --> Done
    WebSkip --> Done
    DiscFormat --> Done
    DiscSkip --> Done

    Done([✅ Notifications Sent]) --> Log[📊 Log Success/Failures]

    style Request fill:#6366f1,stroke:#818cf8,color:#fff
    style Done fill:#10b981,stroke:#34d399,color:#fff
    style ETH fill:#627eea,stroke:#8c9dff,color:#fff
    style POL fill:#8247e5,stroke:#a56eff,color:#fff
    style ARB fill:#28a0f0,stroke:#4fb3f6,color:#fff
    style SEP fill:#fbc02d,stroke:#fdd835,color:#000
    style EmailSend fill:#ec4899,stroke:#f472b6,color:#fff
    style TelSend fill:#0088cc,stroke:#00a6e8,color:#fff
    style WebSend fill:#10b981,stroke:#34d399,color:#fff
    style DiscSend fill:#5865f2,stroke:#7289da,color:#fff
    style SafeAPIClient fill:#1e1b4b,stroke:#6366f1,stroke-width:3px
    style NotificationService fill:#1e1b4b,stroke:#8b5cf6,stroke-width:3px
    style EmailChannel fill:#1e1b4b,stroke:#ec4899,stroke-width:3px
    style TelegramChannel fill:#1e1b4b,stroke:#0088cc,stroke-width:3px
    style WebhookChannel fill:#1e1b4b,stroke:#10b981,stroke-width:3px
    style DiscordChannel fill:#1e1b4b,stroke:#5865f2,stroke-width:3px
```

## Power Features

**🌐 Multi-Chain Support** → Seamlessly queries 4+ blockchain networks with single API

**⚡ Concurrent Fetching** → Parallel requests to multiple Safe APIs for speed

**📢 Flexible Notifications** → Users choose their preferred alert channels

**🎨 Rich Formatting** → Beautiful, readable alerts with risk-based coloring

**🔄 Resilient Delivery** → Failures in one channel don't block others

**🔍 Smart Filtering** → Only fetches pending transactions, ignoring executed ones
