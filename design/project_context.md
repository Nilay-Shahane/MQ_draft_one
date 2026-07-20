# Project Context: JiNiQ Consumer


**Purpose:** Provide an immediate mental map of the JiNiQ consumer architecture to assist in refactoring, debugging, or extending the system.

## Invariants & Contracts
1.  **Atomicity Contract:** The Node.js application MUST NOT perform multi-step database updates. All state changes MUST route through `RedisDB.run()` utilizing predefined Lua scripts.
2.  **Lock Contract:** A worker only owns a job if `GET jiniq-draft:<queue>:lock:<jobId>` returns their exact `workerId`. 
3.  **Timeout Contract:** `JobExecutor` enforces strict timeouts via `AbortController`. User code must respect `signal.aborted`.
4.  **Observability Contract:** All job state changes (completions, failures, and stack traces) MUST be appended to a Redis Stream via `XADD` (capped at `MAXLEN ~ 1000`). We strictly avoid Pub/Sub to ensure dashboards can fetch historical data and never miss dropped events.

## Important Terminology
*   **Supervisor:** The local pool manager controlling concurrency limits.
*   **JobExecutor:** The wrapper around the user's function.
*   **Heartbeat:** The loop keeping the Redis lock alive.
*   **Sweeper:** The interval script that detects missing locks and requeues jobs.
*   **Zombie:** A job in the `active` queue that has no corresponding `lock` key.
*   **Event Stream:** The persistent append-only log (`*:logs`) used by external dashboards to monitor queue health in real-time.

## Data Flow (Happy Path)
1.  `Supervisor` calls `fetchJob()`.
2.  `RedisStorage` invokes `ClaimNextJob.lua`.
3.  Redis returns `jobId`.
4.  `Supervisor` instantiates `JobExecutor` and passes `workerId`.
5.  `JobExecutor` starts `Heartbeat`.
6.  `JobExecutor` awaits `userProcess(payload)`.
7.  Success -> `CheckAndComplete.lua` -> Job moved to `complete` list.
8.  `JobExecutor` -> Appends success payload to Redis Stream (`XADD jiniq-draft:<queue>:logs`).
9.  `Heartbeat` is terminated.

## Major Classes
*   `Worker.js`: Public API facade. Orchestrates DI (Dependency Injection).
*   `Supervisor.js`: Concurrency loop (`claimHandler`).
*   `JobExecutor.js`: Execution sandbox (Timeouts + Error catching).
*   `HeartBeat.js`: Lease extension loop.
*   `Sweeper.js`: Zombie recovery cron.
*   `RedisStorage.js`: Repository pattern over Redis.