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


    beginWork = async () =>{
        const controller = new AbortController()
        const signal = controller.signal
        const newHeartbeatInstance = new this.Heartbeat(this.ttl,this.workerId , this.jobId , this.dbActions , ()=>controller.abort())
        let timeoutId;
        try{
            const payload = await this.dbActions.getPayload(this.jobId)
            
            await newHeartbeatInstance.startHeartbeatProcess()
            
            const timeoutPromise = new Promise((_,reject)=>{
                timeoutId = setTimeout(()=>{
                    controller.abort()
                    reject(new Error(`JOB_TIMEOUT: Process exceeded max execution time of ${this.maxTimeoutMs}ms`));
                } , this.maxTimeoutMs)
            })

            const resp =await Promise.race([
                this.userProcess(payload,signal),
                timeoutPromise
            ])

            const db_resp = await this.dbActions.addToCompleted()
            return resp
            
        }
        catch(e){
            try {
                await this.dbActions.addToFailed(e.message);
            } catch (dbErr) {
                console.log(`Error in db while performed failed job shifting operation ${dbErr}`)
                throw new Error("Failed to record failed job", { cause: dbErr });
                
            }
        }
        finally{ 
            newHeartbeatInstance.setStopHeartBeat(true)
            clearTimeout(timeoutId);
        }
    }
}

module.exports = JobExecutor