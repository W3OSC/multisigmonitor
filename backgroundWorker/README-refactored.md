# Refactored Safe Transaction Monitor Background Worker

This is a refactored version of the background worker for monitoring Gnosis Safe transactions. The code has been restructured to follow a more modular, maintainable architecture with separation of concerns.

## Architecture

The refactored codebase follows a layered architecture with clear separation of responsibilities:

```
backgroundWorker/
├── src/                          # Source code directory
│   ├── config/                   # Configuration modules
│   │   ├── email.js              # Email client configuration
│   │   └── networks.js           # Network configurations for Safe API
│   ├── models/                   # Data models (for future expansion)
│   ├── notifications/            # Notification services
│   │   ├── emailNotifier.js      # Email notification service
│   │   ├── telegramNotifier.js   # Telegram notification service
│   │   ├── webhookNotifier.js    # Webhook notification service (Discord, Slack, etc.)
│   │   └── notificationService.js# Unified notification orchestration service
│   ├── services/                 # Core business logic services
│   │   ├── databaseService.js    # Database (Supabase) interaction service
│   │   ├── safeApiService.js     # Safe API interaction service
│   │   └── transactionProcessorService.js # Main transaction processing logic
│   ├── utils/                    # Utility functions
│   │   └── transactionUtils.js   # Transaction-related utilities
│   └── index.js                  # Application entry point
├── email-templates.js            # Email template generation (unchanged)
├── supabase.js                   # Supabase client (unchanged)
└── webhook-templates.js          # Webhook template generation (unchanged)
```

## Key Components

### Configuration (src/config/)

- **networks.js**: Defines supported blockchain networks and API endpoints
- **email.js**: Email client configuration using Resend

### Services (src/services/)

- **databaseService.js**: Handles all database operations with Supabase
- **safeApiService.js**: Manages communication with the Safe Transaction API
- **transactionProcessorService.js**: Orchestrates the transaction monitoring process

### Notifications (src/notifications/)

- **notificationService.js**: Main notification orchestration service
- **emailNotifier.js**: Email notification implementation
- **webhookNotifier.js**: Webhook notification implementation (Discord, Slack, generic)
- **telegramNotifier.js**: Telegram notification implementation

### Utilities (src/utils/)

- **transactionUtils.js**: Helper functions for transaction analysis

## Design Patterns Used

1. **Singleton Pattern**: Each service is exported as a singleton instance
2. **Service Pattern**: Clear separation of concerns with dedicated services
3. **Facade Pattern**: The notification service provides a simplified interface to the various notification methods

## Running the Application

To run the application:

```bash
cd backgroundWorker
npm install
npm start
```

The service will start and run the transaction check immediately, then schedule it to run every minute using cron.

## Environment Variables

The following environment variables are used:

- `RESEND_API_KEY`: API key for the Resend email service
- `DEFAULT_FROM_EMAIL`: Default sender email address (default: notifications@multisigmonitor.com)
- Supabase credentials (managed by the supabase.js file)

## Future Improvements

Potential areas for further improvement:

1. Add unit and integration tests
2. Implement proper logging with levels (info, debug, error)
3. Add metrics and monitoring
4. Implement more sophisticated transaction analysis
5. Add database migrations for schema changes
6. Create TypeScript typings for better development experience
7. Implement dependency injection for better testability
