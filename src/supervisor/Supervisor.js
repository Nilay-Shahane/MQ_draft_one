const RedisStorage = require('../infrastructure/db/RedisStorage')

const manager = new RedisDB(config)
const fetcher = new RedisDB(config)
//ignore them for now they would be in the index.js / bootstrap later

class Supervisor {
    constructor(name, userProcess, Worker, Heartbeat, maxConcurrency = 10 ) {
        this.name = name;
        this.Worker = Worker;
        this.Heartbeat = Heartbeat; 
        this.userProcess = userProcess;
        this.maxConcurrency = maxConcurrency;
        this.redisInstance = new RedisStorage(this.name , manager , fetcher)
        this.activeWorkers = new Set(); 
    }

    assignWorker = async (jobJson) => {

        const { jobId, ttl, workerId } = jobJson;

        const newWorker = new this.Worker(
            this.Heartbeat, 
            jobId, 
            workerId, 
            ttl, 
            this.userProcess,
            this.redisInstance.getPayload.bind(this.redisInstance),
            this.redisInstance.checkAndUpdateHeartbeat.bind(this.redisInstance)
        );

        const workerPromise = newWorker.beginWork();

        this.activeWorkers.add(workerPromise);


        workerPromise.finally(() => {
            this.activeWorkers.delete(workerPromise);
        });

        return true; 
    }

    get availableSlots() {
        return this.maxConcurrency - this.activeWorkers.size;
    }
}

module.exports = Supervisor;