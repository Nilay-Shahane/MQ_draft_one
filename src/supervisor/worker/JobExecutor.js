class JobExecutor{
    constructor(Heartbeat , jobId , workerId, ttl ,maxTimeoutMs ,  userProcess , dbActions){
        this.ttl = ttl
        this.maxTimeoutMs = maxTimeoutMs
        this.workerId = workerId 
        this.jobId = jobId 
        this.userProcess = userProcess
        this.Heartbeat = Heartbeat
        this.dbActions = dbActions
    }


    beginWork = async () => {
        const controller = new AbortController();
        const newHeartbeatInstance = new this.Heartbeat(this.ttl, this.workerId, this.jobId, this.dbActions, () => controller.abort());
        let timeoutId;

        try {
            const payload = await this.dbActions.getPayload(this.jobId);
            
            await newHeartbeatInstance.startHeartbeatProcess();
            
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error(`JOB_TIMEOUT: Process exceeded max execution time of ${this.maxTimeoutMs}ms`));
                }, this.maxTimeoutMs);
            });

            const resp = await Promise.race([
                this.userProcess(payload, controller.signal),
                timeoutPromise
            ]);

            clearTimeout(timeoutId); 

            try {
                await this.dbActions.addToCompleted();
            } catch (dbErr) {
                console.error(`CRITICAL: Job ${this.jobId} succeeded but failed to mark as complete.`, dbErr);
            }

            return resp; 

        } catch (e) {
            clearTimeout(timeoutId);
            controller.abort(); 

            try {
                await this.dbActions.addToFailed(e.message);
            } catch (dbErr) {
                console.error(`Failed to record failed job: ${dbErr}`);
            }
            
            throw e; //is this needed , why does supervisor need to know it 
        } finally {
            newHeartbeatInstance.setStopHeartBeat(true);
        }
    }
}

module.exports = JobExecutor