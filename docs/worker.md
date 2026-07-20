# JobExecutor Subsystem

The `JobExecutor` class wraps the user's `processorFn` in an execution sandbox with timeouts, heartbeat monitoring, and persistent stream logging.

## Timeout Enforcement
Node.js processes run on a single thread without native execution interruption. JiNiQ enforces execution time limits via `Promise.race`:

```javascript
const resp = await Promise.race([
    this.userProcess(payload, controller.signal),
    timeoutPromise // Rejects after maxTimeoutMs
]);