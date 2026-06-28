const { randomUUID } = require('node:crypto');
const RedisStorage = require('../infrastructure/db/RedisStorage')
const JobFetcher = require('./jobfetcher/JobFetcher')
const manager = new RedisDB(config)
const fetcher = new RedisDB(config)
//ignore them for now they would be in the index.js / bootstrap later

class Supervisor {
    #activeClaim = false
    constructor(jobJson) {
        this.name = jobJson.name;
        this.JobExecutor = jobJson.JobExecutor;
        this.Heartbeat = jobJson.Heartbeat; 
        this.userProcess = jobJson.userProcess;
        this.maxConcurrency = jobJson.maxConcurrency;
        this.storage = new RedisStorage(this.name , manager , fetcher)
        this.activeWorkers = new Set(); 
        this.maxTimeoutMs = jobJson.maxTimeoutMs
        this.ttl = jobJson.ttl
        this.priorityOffset = jobJson.priorityOffset
    }
    hasSlot=()=>{
        return (this.activeWorkers.size < this.maxConcurrency) ;
    }

    workerIdGenerator = async () =>{    
        return randomUUID(); // sync it is , but still for no risk + future decisions
    }

    fetchJob = async () =>{
        const workerId = await this.workerIdGenerator()
        const returnedJson = await this.storage.fromWaitingToActive({
            ttl:this.ttl,
            priorityOffset : this.priorityOffset ,
            workerId : workerId,
        })
        return returnedJson;
    }
    
    claimHandler = async () => {
        if(this.#activeClaim) return;
        this.#activeClaim = true;
        try{
            while(this.hasSlot()){
                
                const returnedJson = await this.fetchJob()
                if(!returnedJson) break;
                const {jobId , workerId} = returnedJson;
                const assignmentResponse = await this.assignJob(returnedJson)
            }
        }
        catch(e){
            console.error("Error during job claiming process:", e);
        }
        finally{
        this.#activeClaim=false;
        }
    }
    

    assignJob = async (jobJson) => {

        const { jobId, workerId } = jobJson;

        const dbActions = {
            getPayload : () => this.storage.getPayload(jobId),   
            addToCompleted: ()  => this.storage.addToCompleted(workerId, jobId),
            addToFailed:    (err)     => this.storage.addToFailed(jobId, workerId , err),
            checkAndUpdateHeartbeat: () => this.storage.checkAndUpdateHeartbeat(this.ttl , jobId , workerId)
        }

        const newWorker = new this.JobExecutor(
            this.Heartbeat, 
            jobId, 
            workerId, 
            this.ttl, 
            this.maxTimeoutMs,
            this.userProcess, 
            dbActions,
        );

        const workerPromise = Promise.resolve().then(() => newWorker.beginWork());

        this.activeWorkers.add(workerId);


        workerPromise.finally(() => {
            this.activeWorkers.delete(workerId);
            this.claimHandler();
        });

        return true; 
    }

    get availableSlots() {
        return this.maxConcurrency - this.activeWorkers.size;
    }
}

module.exports = Supervisor;