const Supervisor = require("../Supervisor");

class Worker extends Supervisor{
    constructor(){
        
    }

    beginWork = async () =>{
        try{
            await this.randomOffset()
            await db.sendHeartBeat(this.jobId, this.workerId)
            this.runHeartbeat().catch(e => {
                // Handle background failure (e.g., stop the worker)
            });
        
            await db.getPayload(this.jobId)

            const resp =await this.userProcess(payload)
            return resp
        }
        catch(e){

        }
        finally{
            this.stopHeartbeat = true
        }
    }
}