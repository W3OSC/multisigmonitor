# Self-Hosted Deployment Stack for Cost-Effective Multisig Monitoring

## Context and Problem Statement

The multisig monitor application requires a deployment strategy that minimizes costs while providing reliable, predictable performance with full control over infrastructure. The application consists of a frontend (Vite/React), background monitoring worker (API polling and heuristic analysis), REST API backend, database for configurations and alerts, and authentication system. Previous consideration of serverless edge functions proved unreliable due to cold starts, execution limits, and unpredictable behavior. How can we deploy this application with predictable performance at minimal cost while maintaining full control?

## Considered Options

- Vercel, Supabase Edge Functions (free tiers)
- Self-hosted single instance with Rust backend and SQLite
- Container orchestration (Kubernetes, Docker Swarm)

## Decision Outcome

Chosen option: "Self-hosted single instance with Rust backend and SQLite", because it provides full control over the entire stack, eliminates cold start issues, offers predictable performance at a fixed cost, and matches the application's workload requirements without the complexity of orchestration or the unpredictability of serverless architectures.

### Decision Outcome Visualization

```mermaid
flowchart TB
    User[User Browser] --> Frontend[Static Frontend<br/>Vite Build]
    Frontend --> API[Axum REST API<br/>Rust + JWT Auth]

    API --> DB[(SQLite Database<br/>Embedded)]
    API --> Worker[Background Worker<br/>API Polling + Heuristics]

    Worker --> ExtAPI[External APIs<br/>Safe Transaction Service]
    Worker --> DB

    PM2[PM2 Process Manager] -.->|monitors| API
    PM2 -.->|monitors| Worker
    PM2 -.->|auto-restart| API
    PM2 -.->|auto-restart| Worker

    GCP[GCP e2-micro Instance<br/>2 vCPU, 1GB RAM, 10GB Disk] -.->|hosts| Frontend
    GCP -.->|hosts| API
    GCP -.->|hosts| Worker
    GCP -.->|hosts| DB
    GCP -.->|hosts| PM2

    classDef decision fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#e2e8f0
    classDef normal fill:#1a202c,stroke:#2d3748,stroke-width:1px,color:#cbd5e0
    classDef highlight fill:#2b6cb0,stroke:#3182ce,stroke-width:2px,color:#e2e8f0
    classDef external fill:#2d3748,stroke:#805ad5,stroke-width:2px,color:#e2e8f0

    class API,Worker decision
    class User,Frontend,DB,PM2 normal
    class GCP highlight
    class ExtAPI external
```

### Consequences

**Positive:**

- Full control over entire stack eliminates vendor lock-in
- Predictable performance with no cold starts
- Simple deployment model with single Rust binary
- Native Rust performance and memory safety guarantees
- SQLite simplicity with no separate database process
- PM2 provides reliability, monitoring, and zero-downtime deployments
- Fixed $8/month cost with GCP e2-micro instance

**Negative:**

- Manual infrastructure management required
- Single point of failure without auto-scaling
- Manual backup strategy must be implemented

**Tradeoffs:**

- Trading serverless convenience for control and reliability
- Single instance sufficient for current monitoring workload
- Instance can be upgraded if needed
- Rust compilation time traded for superior runtime performance
