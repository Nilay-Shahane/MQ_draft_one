const { randomUUID } = require('node:crypto');
const RedisStorage = require('../infrastructure/db/RedisStorage')
const JobFetcher = require('./jobfetcher/JobFetcher')
const manager = new RedisDB(config)
const fetcher = new RedisDB(config)
const EventEmitter = require('events')

class Supervisor extends EventEmitter {
    #activeClaim = false
    #pollInterval = 50 

    constructor(jobJson) {
        super()
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

    hasSlot = () => {
        return (this.activeWorkers.size < this.maxConcurrency);
    }

    workerIdGenerator = async () => {    
        return randomUUID(); 
    }

    fetchJob = async () => {
        const workerId = await this.workerIdGenerator()
        const returnedJson = await this.storage.fromWaitingToActive({
            ttl: this.ttl,
            priorityOffset: this.priorityOffset,
            workerId: workerId,
        })
        return returnedJson;
    }
    
    claimHandler = async () => {
        if(this.#activeClaim) return;
        this.#activeClaim = true;
        let foundWork = false; 

        try {
            while(this.hasSlot()) {
                const returnedJson = await this.fetchJob()
                if(!returnedJson) break;
                
                foundWork = true;
                this.assignJob(returnedJson).catch(err => {
                    console.error(`Slot assignment failed for job ${returnedJson?.jobId}`, err);
                    this.activeWorkers.delete(returnedJson?.workerId);
                });
            }
        }
        catch(e) {
            console.error("Error during job claiming process:", e);
        }
        finally {
            this.#activeClaim = false;

            
            if (foundWork) {
                this.#pollInterval = 50; 
                this.emit('claimNextJob'); 
            } else {
                this.#pollInterval = Math.min(this.#pollInterval * 1.5, 2000);
                setTimeout(() => this.emit('claimNextJob'), this.#pollInterval);
            }
        }
    }

    assignJob = async (jobJson) => {
        const { jobId, workerId } = jobJson;

        const dbActions = {
            getPayload: () => this.storage.getPayload(jobId),   
            addToCompleted: () => this.storage.addToCompleted(workerId, jobId),
            addToFailed: (err) => this.storage.addToFailed(jobId, workerId , err),
            checkAndUpdateHeartbeat: () => this.storage.checkAndUpdateHeartbeat(this.ttl , jobId , workerId)
        }

        const newWorker = new this.JobExecutor(
            this.Heartbeat, jobId, workerId, this.ttl, 
            this.maxTimeoutMs, this.userProcess, dbActions
        );

        const workerPromise = Promise.resolve().then(() => newWorker.beginWork());

        this.activeWorkers.add(workerId);

        workerPromise.catch(err => {
            console.error(err);
        })
        .finally(() => {
            this.activeWorkers.delete(workerId);
            this.#pollInterval = 50;
            this.emit("claimNextJob");
        });

        return true; 
    }

    get availableSlots() {
        return this.maxConcurrency - this.activeWorkers.size;
    }

    callClaimHandler = () => {
        this.on('claimNextJob', async () => {
            try {
                await this.claimHandler()
            }
            catch(e) {
                console.error(e); 
            }
        })
    }   
}

module.exports = Supervisor;