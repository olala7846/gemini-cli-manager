# Automation Layer (`src/automation/`)

The Task Automation Layer handles background execution, CRON jobs, and system maintenance.

## Responsibilities
- **Scheduled Tasks**: Running periodic tasks like memory compaction and summarization (e.g., Nightly workers).
- **Queuing**: Managing asynchronous DAG workflows and task retries via BullMQ.

## Architectural Constraints
- **Triggers**: Like external channels, scheduled jobs emit payloads over `src/protocol/`.
- **Maintenance**: Permitted to interact directly with `src/core/memory/` and `src/core/session/` strictly for database cleanup and summarization operations.
