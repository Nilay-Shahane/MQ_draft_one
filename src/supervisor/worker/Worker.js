const EventEmitter = require('events');
class Worker extends EventEmitter{
    constructor(Heartbeat , jobId , workerId, ttl , userProcess , getPayload , checkAndUpdateHeartbeat){
        super()
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
            this.emit('completedJob',{
                workerId: this.workerId,
                jobId: this.jobId
            })
            return resp
        }
        catch(e){
            // would be flled after catch structure is made 
            this.emit('failedJob',{
                workerId: this.workerId,
                jobId: this.jobId,
                error: e.message||e}
            )
        }
        finally{ 
            newHeartbeatInstance.setStopHeartBeat(true)
        }
    }
}

module.exports = Worker