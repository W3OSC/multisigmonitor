# Naming Conventions Policy

## API Serialization Standard

**Policy:** All JSON payloads at the API boundary use **camelCase**.

### Rationale
1. JavaScript/TypeScript convention (frontend native format)
2. Industry standard for REST APIs
3. Frontend tooling (ESLint, Prettier) expect camelCase
4. Reduces frontend transformation logic

### Implementation

#### Backend (Rust)
- **Internal code:** Use `snake_case` (Rust convention)
- **API types:** Add `#[serde(rename_all = "camelCase")]` to ALL structs crossing the API boundary
- **Database:** Use `snake_case` column names (SQL convention)

```rust
// ✅ Correct
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub user_id: String,        // Internal: snake_case
    pub safe_address: String,   // Internal: snake_case
    pub created_at: String,     // Internal: snake_case
}

// JSON output: {"userId": "...", "safeAddress": "...", "createdAt": "..."}
```

```rust
// ❌ Incorrect - missing serde rename
#[derive(Serialize, Deserialize)]
pub struct UserResponse {
    pub user_id: String,
}
// JSON output: {"user_id": "..."} ← Frontend gets snake_case
```

#### Frontend (TypeScript)
- **All code:** Use `camelCase` (TypeScript convention)
- **API interfaces:** Use `camelCase` field names

```typescript
// ✅ Correct
interface Monitor {
  userId: string;
  safeAddress: string;
  createdAt: string;
}
```

```typescript
// ❌ Incorrect
interface Monitor {
  user_id: string;  // Don't use snake_case
  safe_address: string;
}
```

### Checklist for New API Endpoints

Backend:
- [ ] Add `#[serde(rename_all = "camelCase")]` to request structs
- [ ] Add `#[serde(rename_all = "camelCase")]` to response structs
- [ ] Add `#[serde(rename_all = "camelCase")]` to nested structs
- [ ] Keep internal Rust code using `snake_case`

Frontend:
- [ ] Use `camelCase` in TypeScript interfaces
- [ ] Use `camelCase` when constructing request payloads
- [ ] Use `camelCase` when accessing response fields

### Migration Strategy

When encountering existing code without proper casing:

1. **Add** `#[serde(rename_all = "camelCase")]` to Rust structs
2. **Update** TypeScript interfaces to use `camelCase`
3. **Test** the API endpoint to verify serialization works
4. **Do not** change database column names (breaking change)

### Exception: Database Queries

When returning raw database rows, column names may be `snake_case`. Always transform to camelCase before sending to frontend:

```rust
// Map database rows to API structs with serde rename
let row = sqlx::query_as::<_, MonitorRow>("SELECT user_id, safe_address FROM monitors")
    .fetch_one(&pool)
    .await?;

// MonitorRow struct has #[serde(rename_all = "camelCase")]
Json(row) // Serializes to {"userId": "...", "safeAddress": "..."}
```

## Summary

| Layer | Convention | Example |
|-------|-----------|---------|
| Rust internal code | `snake_case` | `user_id`, `safe_address` |
| Database columns | `snake_case` | `user_id`, `created_at` |
| JSON API payloads | `camelCase` | `userId`, `safeAddress` |
| TypeScript code | `camelCase` | `userId`, `createdAt` |
| Rust API structs | `snake_case` + `#[serde(rename_all = "camelCase")]` | Automatic conversion |

---

## Migration Status

**✅ Complete** - All API boundary structs enforce camelCase JSON serialization

### Backend Models (`backend/src/models/`)
- ✅ `monitor.rs` - Monitor, MonitorWithLastCheck, MonitorSettings, CreateMonitorRequest, UpdateMonitorRequest
- ✅ `api_key.rs` - ApiKey, ApiKeyResponse, CreateApiKeyRequest, CreateApiKeyResponse
- ✅ `user.rs` - User, UserResponse
- ✅ `security_analysis.rs` - All security analysis models

### Backend API Structs (`backend/src/api/`)
- ✅ `notifications.rs` - NotificationRecord
- ✅ `sanctions.rs` - SanctionsResponse
- ✅ `dashboard.rs` - DashboardStats
- ✅ `multisig_info.rs` - MultisigInfoResponse
- ✅ `transactions.rs` - TransactionRecord, TransactionListQuery, SecurityAnalysisSummary
- ✅ `security_analysis.rs` - All security assessment models

### Frontend (`frontend/src/lib/api.ts`)
- ✅ All TypeScript interfaces updated to camelCase

### Verification
- ✅ Backend compiles successfully (`cargo build`)
- ✅ All API structs have proper `#[serde(rename_all = "camelCase")]` attributes
