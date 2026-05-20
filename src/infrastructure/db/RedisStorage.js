const BaseStorage = require('./BaseStorage')
const RedisDB = require('./RedisDB')

class RedisStorage extends BaseStorage{
    constructor(nameOfQ , ManagerInstance , FetcherInstance ,config={}){
        super()
        this.keyMap = {
            main: `jiniq-draft:${nameOfQ}:main`,
            priority: `jiniq-draft:${nameOfQ}:priority`,
            normal: `jiniq-draft:${nameOfQ}:normal`,
            active: `jiniq-draft:${nameOfQ}:active`,
            lock: `jiniq-draft:${nameOfQ}:lock`,
            complete: `jiniq-draft:${nameOfQ}:complete`,
            delay: `jiniq-draft:${nameOfQ}:delay`,
            dead: `jiniq-draft:${nameOfQ}:dead`,
        }
        
        this.manager = ManagerInstance
        this.fetcher = FetcherInstance

    }

    async getPayload(jobId){
        return this.manager.hget(`${this.keyMap.main}:${jobId}`,'payload')
    }
    async fromWaitingToActive(jobJson) {
        const {ttl = 30000 , priorityOffset = 10000 , workerId } = jobJson

        const keys = [
            this.keyMap.priority,
            this.keyMap.normal, 
            this.keyMap.active,
            this.keyMap.lock
        ];

        const timestamp = Date.now();
        

        return await this.fetcher.claimNextJob(...keys , ttl , timestamp , priorityOffset , workerId);
    }

    async checkAndUpdateHeartbeat(heartbeat , jobId , workerId) {
        const keys = [
            this.keyMap.lock
        ]
        return await this.manager.renewJobLease(...keys , jobId , workerId , heartbeat)
    }

    async addToCompleted(workerId , jobId){
        const keys = [
            this.keyMap.lock,
            this.keyMap.active,
            this.keyMap.complete
        ]
        return await this.manager.checkAndComplete(...keys , jobId , workerId)
    }

    async failedToJob(jobId ,workerId){
        const keys = [
            this.keyMap.lock,
            this.keyMap.active,
            this.keyMap.delay,
            this.keyMap.dead
        ]
        const jobKey = `${this.keyMap.main}:${jobId}`
        return await this.manager.addToDelayedOrDead(...keys , jobId , workerId , jobKey)
    }

    async shutdown() {
        
        await Promise.all([
            this.manager.disconnect(),
            this.fetcher.disconnect()
        ]);
    }
}

module.exports = RedisStorage