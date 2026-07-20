# Supervisor Subsystem

The `Supervisor` is the core pool manager and execution coordinator of a worker node. It manages concurrency slots and polling backoff.

## Polling Strategy (`claimHandler`)
Rather than using a fixed `setInterval` timer (which wastes network bandwidth when queues are empty), the `Supervisor` uses a dynamic recursive polling loop with exponential backoff:

1. `hasSlot()` checks if `activeWorkers.size < maxConcurrency`.
2. If slots are available, it executes `fetchJob()`.
3. If a job is returned, `#pollInterval` resets immediately to `50ms` and continues fetching.
4. If no job is returned, `#pollInterval` is scaled up (`#pollInterval * 1.5`, capped at `2000ms`), and a `setTimeout` schedules the next claim cycle.

## Slot Assignment & Execution Lifecycle
When a job is fetched:
1. `assignJob()` packages worker database helper functions (`dbActions`) for `JobExecutor`.
2. A new `JobExecutor` instance is initialized and added to the `activeWorkers` set.
3. The job execution promise runs asynchronously.
4. Upon completion or failure, the worker slot is freed in the `.finally()` handler, triggering a claim cycle check to fill freed capacity immediately.