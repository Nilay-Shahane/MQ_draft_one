class Worker{
    constructor(Heartbeat , jobId , workerId, ttl , userProcess , getPayload , checkAndUpdateHeartbeat){
        this.ttl = ttl
        this.workerId = workerId 
        this.jobId = jobId 
        this.userProcess = userProcess
        this.Heartbeat = Heartbeat
        this.getPayload =getPayload
        this.checkAndUpdateHeartbeat = checkAndUpdateHeartbeat
    }

    beginWork = async () =>{
        const newHeartbeatInstance = new this.Heartbeat(this.ttl,this.workerId , this.jobId , this.checkAndUpdateHeartbeat)
        
        try{
            const payload = await this.getPayload(this.jobId)

            await newHeartbeatInstance.startHeartbeatProcess()

            const resp =await this.userProcess(payload)
            return resp
        }
        catch(e){
            // would be flled after catch structure is made 
        }
        finally{ 
            newHeartbeatInstance.setStopHeartBeat(true)
        }
    }
}

module.exports = Worker