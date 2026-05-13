class HeartBeat{
    #stopHeartbeat = false
    #flagForOffset = false
    constructor(heartbeat,workerId , jobId , userProcess){
        this.heartbeat = heartbeat
        this.workerId = workerId 
        this.jobId = jobId 
        this.userProcess = userProcess
    }
    
    getStopHeartBeat(){
        return this.#stopHeartbeat
    }
    setStopHeartBeat(value){
        this.#stopHeartbeat=value
    }
    getFlagForOffset(){
        return this.#flagForOffset
    }
    setFlagForOffset(value){
        this.#flagForOffset=value
    }

    randomOffset = async () =>{
        if(! this.getFlagForOffset()){
            let jitter = Math.random()*1000
            await sleep(jitter)
            this.setFlagForOffset(true)
        }
        return
    }


    runHeartbeat = async () => {
        try {
            

            while (!this.getStopHeartBeat()) {

                await sleep(this.heartbeat / 3)

                await db.sendHeartBeat(this.jobId, this.workerId)

            }

        } catch (e) {
            //error to be filled after making error fs
            this.setStopHeartBeat(true) 
        }
    }


    
}