# Lua Scripts Reference

All distributed state consistency in JiNiQ relies on atomic Lua scripts to eliminate race conditions across distributed worker nodes.

### 1. `ClaimNextJob.lua`
*   **Purpose:** Migrates mature delayed jobs to the normal queue, compares priority vs normal queues using a score offset, locks the selected job, and routes it to the active list.
*   **Inputs:** `priorityQ`, `normalQ`, `activeQ`, `lockPrefix`, `delayQ`, `ttl`, `now`, `offset`, `workerId`.
*   **Guarantees:** A job cannot be double-claimed across workers. The lock presence check prevents duplicate execution.
*   **Complexity:** O(log(N)) due to Sorted Set operations.

### 2. `CheckAndUpdateHeartbeat.lua`
*   **Purpose:** Renews the TTL of a job lock if and only if the calling worker matches the current lock owner.
*   **Inputs:** `jobKey`, `workerId`, `heartbeat` (TTL in ms).
*   **Guarantees:** Prevents brain-split and stale renewals. If a worker loses ownership due to a timeout or crash, late renewals are rejected with `-1`.
*   **Complexity:** O(1).

### 3. `CheckAndComplete.lua`
*   **Purpose:** Safely completes a job by verifying lock ownership, removing the active record, releasing the lock, and pushing the job ID to the complete list.
*   **Inputs:** `lockPrefix`, `activeQ`, `completeQ`, `jobId`, `workerId`.
*   **Guarantees:** Ensures a worker whose lease expired cannot mark a job as completed.
*   **Complexity:** O(N) for list entry removal (`LREM`), O(1) for lock deletion and completion list append.

### 4. `Sweeper.lua`
*   **Purpose:** Scans the active list for orphaned jobs (missing lock keys), increments their attempt counters, and routes them to retry or DLQ.
*   **Inputs:** `activeQ`, `delayQ`, `deadQ`, `lockPrefix`, `jobHashPrefix`.
*   **Logic:** Iterates over `activeQ`. If `lockPrefix:jobId` does not exist, the owning worker flatlined. The script increments `currAttempt` in the main job hash and moves the job ID to `delayQ` (if `currAttempt <= maxAttempt`) or `deadQ` (DLQ).
*   **Complexity:** O(N) where N is the number of active jobs in the queue.