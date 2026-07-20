# Redis Data Schema

JiNiQ utilizes a structured namespace: `jiniq-draft:<queueName>:<type>`

| Key / Type | Data Structure | Purpose | Lifecycle / Complexity |
| :--- | :--- | :--- | :--- |
| `*:main:<jobId>` | **HASH** | Stores job immutable data (`payload`, `maxAttempt`) and mutable state (`currAttempt`). | Created on submit. O(1) HGET/HSET. |
| `*:normal` | **ZSET** | Queue for standard jobs. Score = timestamp. | O(log(N)) insertions and pops. |
| `*:priority` | **ZSET** | Queue for high-priority jobs. Score = timestamp - priorityOffset. | O(log(N)). Polled before normal. |
| `*:delay` | **ZSET** | Jobs waiting to execute. Score = execution timestamp. | O(log(N)). Migrated to normal upon maturity. |
| `*:active` | **LIST** | Jobs currently assigned to a worker. Value format: `jobId:workerId`. | O(1) Push. O(N) removal. Sweeper scans this. |
| `*:lock:<jobId>` | **STRING** | The lease. Value is `workerId`. Has a volatile TTL. | Created on claim. Extended by Heartbeat. O(1). |
| `*:complete` | **LIST** | Historical record of successful jobs. | O(1) append. |
| `*:dead` | **LIST** | Dead Letter Queue (DLQ) for permanently failed jobs. | O(1) append. |
| `*:logs` | **STREAM** | Persistent event stream for execution logs, status transitions, and error stack traces. | Appended via `XADD` with `MAXLEN ~ 1000`. O(1) append complexity. |