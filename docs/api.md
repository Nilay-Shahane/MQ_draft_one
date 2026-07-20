# Consumer API Reference

This document describes the public API exposed by JiNiQ for consuming jobs.

---

# Worker Class

The `Worker` class is the primary consumer interface.

It is responsible for:

- establishing Redis connections
- creating worker supervisors
- starting heartbeat services
- launching the sweeper
- continuously polling for new jobs

---

## Constructor

```javascript
new Worker(queueName, processorFn, options)
```

### Parameters

#### `queueName`

Type:

```text
string
```

Required.

The name of the queue this worker consumes.

Example:

```javascript
new Worker("emails", ...)
```

---

#### `processorFn`

Type:

```javascript
(payload, abortSignal) => Promise<any>
```

Required.

This asynchronous function contains the business logic executed for every job.

Example:

```javascript
async function processor(payload, signal) {
    ...
}
```

The second argument is an `AbortSignal`.

If the worker loses lock ownership or exceeds timeout, this signal becomes aborted.

---

#### `options`

Type:

```text
Object
```

Optional.

Configuration values controlling worker behavior.

---

## Configuration Options

| Option | Type | Default | Description |
|---------|------|----------|-------------|
| concurrency | Number | 1 | Maximum number of jobs processed simultaneously |
| lockDuration | Number | 30000 | Lease TTL in milliseconds |
| maxTimeoutMs | Number | 300000 | Maximum execution timeout (5 minutes) |
| sweeperInterval | Number | 30000 | Interval between sweeper executions |
| redisConfig | Object | {} | Standard ioredis configuration |

---

# Methods

## start()

```javascript
await worker.start()
```

Starts the worker.

This method:

- connects Redis clients
- starts heartbeat services
- launches the Sweeper
- begins polling for jobs

---

## stop()

```javascript
await worker.stop()
```

Gracefully shuts down the worker.

Shutdown sequence:

1. stop polling
2. stop accepting new jobs
3. stop heartbeat timers
4. wait for active jobs to finish
5. disconnect Redis connections

---

# Events

The Worker extends Node.js `EventEmitter`.

Applications can subscribe to lifecycle events.

---

## job:completed

Emitted when a job finishes successfully.

Payload:

```javascript
{
    jobId,
    workerId,
    result
}
```

Example:

```javascript
worker.on("job:completed", (event) => {
    console.log(event.jobId);
});
```

---

## job:failed

Emitted when a job fails because of:

- thrown exception
- timeout
- lock ownership loss
- aborted execution

Payload:

```javascript
{
    jobId,
    workerId,
    error
}
```

Example:

```javascript
worker.on("job:failed", (event) => {
    console.error(event.error);
});
```

---

# Example

```javascript
const worker = new Worker(
    "emails",
    async (payload, signal) => {
        console.log(payload);

        if (signal.aborted) {
            return;
        }

        // Process the job...
    },
    {
        concurrency: 5,
        lockDuration: 30000
    }
);

await worker.start();
```

---

# Summary

The `Worker` class provides a simple, high-level interface for consuming jobs while internally managing concurrency, heartbeats, retries, timeout enforcement, and crash recovery. Applications only need to implement the processing function—the queue infrastructure handles the distributed coordination automatically.