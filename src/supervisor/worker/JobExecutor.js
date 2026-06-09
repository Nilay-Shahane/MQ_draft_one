class JobExecutor{
    constructor(Heartbeat , jobId , workerId, ttl ,maxTimeoutMs ,  userProcess , storage){
        this.ttl = ttl
        this.maxTimeoutMs = maxTimeoutMs
        this.workerId = workerId 
        this.jobId = jobId 
        this.userProcess = userProcess
        this.Heartbeat = Heartbeat
        this.storage = storage
    }


    beginWork = async () =>{
        const newHeartbeatInstance = new this.Heartbeat(this.ttl,this.workerId , this.jobId , this.storage)
        
        try{
            const payload = await this.storage.getPayload(this.jobId)
            
            await newHeartbeatInstance.startHeartbeatProcess()

            const timeoutPromise = new Promise((_,reject)=>{
                let timeoutId = setTimeout(()=>{
                    reject(new Error(`JOB_TIMEOUT: Process exceeded max execution time of ${this.maxTimeoutMs}ms`));
                } , this.maxTimeoutMs)
            })

            const resp =await Promise.race([
                this.userProcess(payload),
                timeoutPromise
            ])

            const db_resp = await this.storage.addToCompleted(this.workerId , this.jobId)
            return resp
        }
        catch(e){
            // would be flled after catch structure is made 
            const db_resp_failed = await this.storage.addToFailed(this.jobId , this.workerId , e)
        }
        finally{ 
            newHeartbeatInstance.setStopHeartBeat(true)
        }
    }
}

module.exports = JobExecutor