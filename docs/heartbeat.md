# Heartbeat Subsystem

Distributed queues require a deterministic mechanism to distinguish slow workers from stalled or crashed workers. JiNiQ implements a lease-based heartbeat mechanism to ensure only the current lock owner is allowed to continue processing a job.

## Overview

Each claimed job is protected by a Redis lock with a configurable TTL (`lockDuration`). While a worker is processing the job, a background heartbeat periodically renews this lease.

If the worker crashes, loses network connectivity, or otherwise fails to renew the lease, the lock expires automatically. This allows another worker to safely recover the job.

---

## Lease Lifecycle

### 1. Job Acquisition

When `ClaimNextJob.lua` assigns a job to a worker, it atomically:

- Removes the job from the waiting queue
- Creates a lock

```
jiniq-draft:<queue>:lock:<jobId>
```

- Sets the lock owner to the worker ID
- Applies a TTL equal to `lockDuration`

At this point, the worker becomes the exclusive owner of the job.

---

### 2. Startup Jitter

Before the first renewal cycle, the heartbeat waits for a small randomized delay.

```javascript
Math.random() * 50ms
```

This prevents hundreds of workers that start simultaneously from sending lease renewal requests to Redis at exactly the same moment (the "thundering herd" problem).

---

### 3. Lease Renewal

After the initial jitter, the heartbeat renews the lease every:

```
lockDuration / 3
```

This provides multiple opportunities to refresh the lock before it expires.

Renewal is performed using the atomic Redis Lua command:

```
renewJobLease(...)
```

---

### 4. Ownership Validation

The renewal script verifies:

- the lock still exists
- the current worker still owns it

Possible responses:

| Return Value | Meaning |
|-------------|---------|
| `1` | Lease successfully renewed |
| `-1` | Lock expired or ownership lost |

---

### 5. Ownership Loss

If `renewJobLease()` returns `-1`:

- the heartbeat immediately stops
- `abortFn()` is executed
- the worker's `AbortController` is triggered
- the processor function receives an aborted signal

The worker must immediately stop executing business logic.

This prevents multiple workers from processing the same job simultaneously.

---

## Why Abort Immediately?

Consider this scenario:

```
Worker A
    │
    │ processing...
    │
(network partition)
    │
Heartbeat fails
    │
Lock expires
    │
Worker B claims job
```

If Worker A continued processing after losing ownership, both workers would execute the same job.

Immediate abortion eliminates this race condition.

---

## Design Benefits

- Automatic crash detection
- Safe lease-based ownership
- Prevents duplicate processing
- Handles temporary network failures
- Minimal Redis overhead
- Fully atomic lease validation

---

## Summary

The Heartbeat subsystem continuously proves that a worker still owns its job. If ownership is ever lost, processing is aborted immediately, allowing the queue to safely recover the job without risking concurrent execution.