const RedisStorage = require('../infrastructure/db/RedisStorage')
const JobFetcher = require('./jobfetcher/JobFetcher')
const manager = new RedisDB(config)
const fetcher = new RedisDB(config)
//ignore them for now they would be in the index.js / bootstrap later

class Supervisor {
    #activeClaim = false
    constructor(name, userProcess, JobExecutor, Heartbeat, maxConcurrency = 10 ) {
        this.name = name;
        this.JobExecutor = JobExecutor;
        this.Heartbeat = Heartbeat; 
        this.userProcess = userProcess;
        this.maxConcurrency = maxConcurrency;
        this.storage = new RedisStorage(this.name , manager , fetcher)
        this.activeWorkers = new Set(); 
    }
    hasSlot=()=>{
        return (this.activeWorkers.size < this.maxConcurrency) ;
    }

    claimHandler = () => {
        if(this.#activeClaim) return;
        this.#activeClaim = true;
        while(this.hasSlot()){
            //generate worker id 
            //call db func
            //if null break 
            //if not proceed to call assign job
            //concurrecy+=1
        }
        this.#activeClaim=false;
    }
    

    // assignJob = async (jobJson) => {

    //     const { jobId, ttl, workerId } = jobJson;

    //     const newWorker = new this.JobExecutor(
    //         this.Heartbeat, 
    //         jobId, 
    //         workerId, 
    //         ttl, 
    //         this.userProcess,
    //         this.storage,
    //     );

    //     const workerPromise = newWorker.beginWork();

    //     this.activeWorkers.add(workerPromise);


    //     workerPromise.finally(() => {
    //         this.activeWorkers.delete(workerPromise);
    //     });

    //     return true; 
    // }

    // get availableSlots() {
    //     return this.maxConcurrency - this.activeWorkers.size;
    // }
}

module.exports = Supervisor;