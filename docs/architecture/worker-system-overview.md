# Worker System Overview

> How the monitoring engine continuously watches your Safe wallets and keeps you informed

```mermaid
flowchart TB
    Start([Timer Triggers Every 60s]) --> Worker

    subgraph WorkerProcess[Worker Process]
        Worker[Monitor Worker]
        Worker -->|fetches| DB1[(Database)]
        Worker -->|groups| Logic{Group by Address + Network}
    end

    Logic -->|parallel| SafeAPI

    subgraph WorkerSubsystem[Worker Subsystem]
        SafeAPI[Safe API Client]
        SafeAPI --> Net1[Ethereum]
        SafeAPI --> Net2[Polygon]
        SafeAPI --> Net3[Arbitrum]
        
        Net1 --> TxData{New Transaction?}
        Net2 --> TxData
        Net3 --> TxData
    end

    TxData -->|yes| Services

    subgraph ServicesLayer[Services Layer]
        Security[Security Analysis]
        Security --> Checks[Risk Detection]
        Checks --> Risk[Risk Score]
    end

    Risk --> Notify

    subgraph Notifications[Multi-Channel Alerts]
        Notify[Notification Service]
        Notify --> Email[Email]
        Notify --> Telegram[Telegram]
        Notify --> Webhook[Webhook]
        Notify --> Discord[Discord]
    end

    Email --> DB2[(Database)]
    Telegram --> DB2
    Webhook --> DB2
    Discord --> DB2
    
    DB2 --> Loop([Cycle Repeats])
```

## The Power Flow

**Watch** → Monitors continuously poll Safe Transaction Services across multiple chains

**Analyze** → Every transaction is risk-assessed using security heuristics and pattern detection

**Alert** → Instant notifications through your preferred channels when threats are detected

**Remember** → System tracks notification history to avoid alert fatigue
