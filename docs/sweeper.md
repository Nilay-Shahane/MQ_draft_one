# Sweeper Subsystem

The Sweeper is JiNiQ's recovery mechanism responsible for detecting abandoned jobs and returning them back into the queue.

It acts as the garbage collector for distributed workers.

---

## Why is a Sweeper Needed?

Normally, workers renew their lease while processing jobs.

However, unexpected failures can occur:

- worker process crashes
- machine reboot
- container termination
- network partition
- heartbeat failure

When this happens:

- the Redis lock eventually expires
- but the job still exists inside the active queue

Without cleanup, these jobs would remain stuck forever.

The Sweeper periodically scans for these orphaned jobs and recovers them.

---

## Execution Flow

Every

```
sweeperInterval
```

(default:

```
30000 ms
```

)

the worker executes:

```
Sweeper.lua
```

---

## Recovery Algorithm

### Step 1

Fetch every active job entry.

Each entry has the format:

```
jobId:workerId
```

Example:

```
42:worker-17
```

---

### Step 2

For every active entry, check whether its lock still exists.

```
jiniq-draft:<queue>:lock:<jobId>
```

---

### Step 3

If the lock exists:

```
Job is still healthy
```

Do nothing.

---

### Step 4

If the lock is missing:

The owning worker has either:

- crashed
- stopped heartbeating
- lost ownership

The job is now considered abandoned.

---

### Step 5

Recover the job atomically.

The Lua script performs:

- remove entry from active queue
- increment `currAttempt`
- compare against `maxAttempt`

If retries remain:

```
delayQ
```

Otherwise:

```
deadQ
```

All of these operations happen inside one Redis transaction (Lua script).

---

## Why Lua?

Recovery must be atomic.

Without Lua:

```
Worker A:
reads active job

Worker B:
also reads active job

Both recover it.
```

Duplicate recovery becomes possible.

Running everything inside Redis guarantees only one recovery operation succeeds.

---

## Complexity

Current implementation:

```
O(N)
```

where **N** equals the number of active jobs.

This is acceptable because active queues are generally much smaller than waiting queues.

---

## Future Optimization

For extremely large deployments, the active queue can be replaced with a Sorted Set.

Benefits include:

- efficient expiration lookup
- range scans
- timestamp ordering
- lower recovery latency

---

## Design Benefits

- Automatic recovery of abandoned jobs
- Crash resilience
- Retry management
- Dead-letter routing
- Atomic cleanup
- Cluster-safe execution

---

## Summary

The Sweeper ensures that jobs never remain permanently stuck in the active queue. By periodically checking lock ownership and atomically recovering abandoned jobs, JiNiQ maintains forward progress even in the presence of worker crashes or network failures.