# Engineering Design Document: JiNiQ Worker Ecosystem

## Problem Statement

Processing asynchronous background jobs in a distributed Node.js environment introduces severe challenges regarding concurrency control, worker failure detection, and exactly-once (or at-least-once) execution semantics. Traditional polling queues suffer from race conditions when multiple workers attempt to claim the same job and fail to distinguish between a long-running job and a crashed worker.

---

## Design Goals

1. **At-Least-Once Delivery**
   - Ensure no job is lost if a Node.js process OOMs, crashes, or loses network connectivity.

2. **Lock Exclusivity**
   - A single job must strictly be processed by one worker at a time.

3. **Resilience to Node Event Loop Lag**
   - Ensure heartbeats and timeouts account for JavaScript's single-threaded nature.

4. **Minimal Redis Overhead**
   - Optimize polling intervals to prevent Redis CPU saturation.

---

## Non-Goals

- Exactly-once processing (users must write idempotent processor functions).
- Complex workflow orchestration (DAGs). JiNiQ is a strict queue, not a workflow engine.

---

## Overall Architecture

The system uses the **Claim-and-Lease** pattern.

Instead of simply popping a job off a list, a worker atomically moves the job to an `active` state and acquires a temporary `lock`. As long as the worker is alive, a background `HeartBeat` interval continuously extends this lock. If the worker dies, the lock expires. A cluster-wide `Sweeper` detects active jobs without locks and recovers them.

---

## Key Components

### 1. Redis Data Model

JiNiQ relies heavily on Redis data structures to provide efficient lookups and ordering.

- **Sorted Sets (ZSETs)** (`delay`, `priority`, `normal`)
  - Used for time-based scheduling and priority ordering.
  - Provide efficient `O(log N)` insertion and retrieval.

- **Hashes** (`main`)
  - Store serialized job payloads.
  - Enable constant-time (`O(1)`) payload lookup.

- **Strings** (`lock`)
  - Represent temporary worker leases.
  - Expire automatically using Redis TTL.

---

### 2. Lua Script Responsibilities

To eliminate race conditions, Node.js never performs multi-step read-modify-write operations.

Instead, every state transition is executed inside Redis using Lua scripts.

Since Redis executes Lua scripts atomically, no other client can interrupt execution midway. Even if thousands of workers poll simultaneously, only one worker can successfully claim a particular job.

This guarantees safe concurrent execution without requiring distributed locks at the application layer.

---

### 3. Failure Recovery & The Sweeper

#### The Problem

If a worker crashes while executing a job, that job remains inside the `activeQ`.

Without additional recovery logic, it would never become available again.

#### The Solution

The **Sweeper** acts as a garbage collector.

It periodically scans every active job and checks whether its corresponding lock still exists.

- If the lock exists, the worker is still alive.
- If the lock has expired, the worker is assumed to have crashed.

The Sweeper then atomically:

1. Increments the retry attempt counter.
2. Checks whether the retry limit has been exceeded.
3. Moves the job either:
   - back to the delayed queue for retry, or
   - into the Dead Letter Queue (DLQ).

This ensures that abandoned jobs are automatically recovered.

---

### 4. Heartbeat Design

Workers periodically renew their lease while processing a job.

JiNiQ schedules heartbeat renewals every:

```
TTL / 3
```

For example:

- Lock TTL = **30 seconds**
- Heartbeat Interval = **10 seconds**

This provides enough safety margin even if the Node.js event loop experiences temporary blocking or GC pauses.

To further reduce Redis load, JiNiQ introduces a random startup delay (**jitter**) before beginning heartbeat scheduling.

This prevents hundreds of workers from renewing locks simultaneously (the **Thundering Herd Problem**).

---

### 5. Persistent Event Logging (Redis Streams)

Instead of using Redis Pub/Sub, JiNiQ stores execution events inside Redis Streams (`XADD`).

#### Problem

Pub/Sub is fire-and-forget.

If a monitoring dashboard disconnects even briefly, every published message during that period is permanently lost.

#### Solution

JiNiQ writes every event into a capped Redis Stream.

```
*:logs
```

using:

```
XADD MAXLEN ~ 1000
```

This provides:

- Ordered event history
- Persistent log storage
- Automatic trimming
- Ability to replay historical events

A monitoring dashboard can:

1. Fetch previous events using:

```
XREVRANGE
```

2. Continue receiving live events using a blocking:

```
XREAD
```

This enables both historical inspection and real-time monitoring.

---

## Tradeoffs

### Latency vs Reliability

Every completed job requires additional Redis operations:

- Heartbeat renewals
- State transitions
- Event logging

These extra round trips slightly increase processing latency but significantly improve reliability and observability.

---

### Sweeper Scalability

The current Sweeper implementation scans the complete active queue using:

```
LRANGE 0 -1
```

This is an **O(N)** operation.

At very large scales (millions of active jobs), the Lua script may block Redis's single-threaded event loop for noticeable periods.

Future optimizations could include:

- Cursor-based scanning
- Partitioned active queues
- Redis Streams for active tracking
- Batched recovery operations