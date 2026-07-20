# System Architecture

JiNiQ separates the concerns of execution, coordination, state management, and observability. 

## Component Interaction

The `Worker` acts as the root composer, injecting dependencies into the `Supervisor`. The `Supervisor` manages a local pool of active asynchronous tasks (up to `maxConcurrency`).

When a slot is free, the Supervisor asks `RedisStorage` for work. If work is found, it is handed to a `JobExecutor`. The `JobExecutor` runs the task while spinning up a `HeartBeat` to maintain the lock. Finally, execution results (success or failure traces) are streamed persistently to Redis for external dashboards to consume.

```mermaid
graph TD
    W[Worker] --> S[Supervisor]
    W --> SW[Sweeper]
    S --> |Spawns| JE1[JobExecutor 1]
    S --> |Spawns| JE2[JobExecutor 2]
    JE1 --> |Spawns| HB1[HeartBeat]
    JE1 --> |Executes| UP[User Process]
    
    HB1 -.-> |Lua: renewJobLease| R[(Redis)]
    SW -.-> |Lua: sweeper| R
    S -.-> |Lua: claimNextJob| R
    JE1 -.-> |XADD: stream logs| R