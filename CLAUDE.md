# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Safe Watch Jettison Protocol is a blockchain transaction monitoring system for Gnosis Safe (now Safe) wallets. The system monitors Safe transactions across multiple networks and sends notifications through various channels (Email, Telegram, Discord, Slack, Webhooks).

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (dev server on port 8080)
- Tailwind CSS with custom Jet Set Radio inspired theme
- shadcn/ui components (Radix UI based)
- Tanstack Query for data fetching
- Supabase for authentication
- Safe Global API Kit for blockchain interaction

**Backend:**
- Node.js background worker for transaction monitoring
- Supabase (PostgreSQL with RLS policies)
- Node-cron for scheduled monitoring (1-minute intervals)
- Resend for email notifications
- Deno Edge Functions for Discord OAuth

## Key Development Commands

### Frontend Commands
```bash
cd frontend
npm run dev          # Start dev server on localhost:8080
npm run build        # Production build
npm run lint         # Run ESLint
```

### Background Worker Commands
```bash
cd backgroundWorker
npm start           # Start the monitoring service
```

### Testing Notifications
```bash
cd backgroundWorker
node insert-test-transaction.js  # Create test transactions for notification testing
```

## Architecture

### Frontend Structure
- `/frontend/src/pages/` - Route components (React Router)
- `/frontend/src/components/` - Reusable UI components
- `/frontend/src/context/AuthContext.tsx` - Authentication state management
- `/frontend/src/integrations/supabase/` - Supabase client and types

### Background Worker Structure
- `/backgroundWorker/src/services/` - Core business logic
  - `transactionProcessorService.js` - Main monitoring orchestration
  - `safeApiService.js` - Safe API interactions
  - `databaseService.js` - Supabase database operations
- `/backgroundWorker/src/notifications/` - Notification implementations
  - `notificationService.js` - Unified notification orchestration
- `/backgroundWorker/src/config/networks.js` - Supported blockchain networks

### Database Schema
Key tables with RLS policies:
- `monitors` - User monitoring configurations
- `results` - Transaction scan results
- `last_checks` - Monitoring state tracking
- `notification_status` - Notification delivery tracking

## Important Development Notes

1. **Authentication**: Uses Supabase Auth with Discord OAuth. Service role required for background worker.

2. **Environment Variables**: Background worker requires:
   - `RESEND_API_KEY` - Email service
   - `DEFAULT_FROM_EMAIL` - Sender email
   - Supabase credentials in `supabase.js`

3. **Supported Networks**: Defined in `/backgroundWorker/src/config/networks.js`
   - Ethereum, Polygon, BSC, Gnosis, Avalanche, Optimism, Arbitrum, Celo, Aurora, Zksync, Base, Scroll, Sepolia

4. **Notification Types**:
   - Email (via Resend)
   - Telegram (bot token required)
   - Discord/Slack webhooks
   - Generic webhooks

5. **No Test Framework**: Currently no unit tests configured. Consider adding Vitest for frontend and Jest for backend.

6. **Database Access**: Frontend uses RLS policies, background worker uses service role for full access.

7. **Transaction Monitoring**: Runs every minute via cron, checks for new transactions since last check.