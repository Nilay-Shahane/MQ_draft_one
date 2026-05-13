class Supervisor{
    constructor(name , process , Worker){
        this.name = name
        this.Worker = Worker
        this.process = process
    }

    assignWorker = async (jobJson) => {
        const {jobId , heartbeat , workerId} = jobJson
        const newWorker = new this.Worker()
        await newWorker.work(jobId , this.process)
    }
}

module.exports = Supervisor
