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
        return this.manager.client.hget(`${this.keyMap.main}:${jobId}`,'payload')
    }
    async addJobToQueue(serializedJob ,options = {}){
        const jobId = serializedJob.id;
        const jobKey = `${this.keyMap.main}:${jobId}`;
        const keys = [
            jobKey,
            this.keyMap.priority,
            this.keyMap.normal,
            this.keyMap.delay
        ];
        const hashArgs = [];

        for(const [key,value] of Object.entries(serializedJob)){
            hashArgs.push(key,value==null  || value == undefined ? " " : value.toString());
        }
        
        const timestamp = Date.now();
        const priorityOffset = 10000;
        const maxQueueSize = options.maxQueueSize || 0;

        const args = [jobId,
            serializedJob.priority || "normal",
            serializedJob.delay || 0,
            timestamp,
            priorityOffset,
            maxQueueSize,
            ...hashArgs]
           
            const result = await this.manager.run('addJobtoQueue', ...keys,...args);

            if (result === -1) {
            throw new Error(`QueueFullError: Cannot add job. The queue "${this.keyMap.main}" has reached its maximum capacity of ${maxQueueSize}.`);
           }
            return result;
    }

        async addBulkJobs(serializedJobsArray, options = {}) {
        const CHUNK_SIZE = options.chunkSize || 1000; 
        let successCount = 0;
        let failedCount = 0;
        const failedJobs = [];

        const timestamp = Date.now();
        const priorityOffset = 10000;
        const maxQueueSize = options.maxQueueSize || 0;

        for (let i = 0; i < serializedJobsArray.length; i += CHUNK_SIZE) {
            const chunk = serializedJobsArray.slice(i, i + CHUNK_SIZE);
            const pipeline = this.manager.pipeline();
            
            for (const serializedJob of chunk) {
                const jobId = serializedJob.id;
                const jobKey = `${this.keyMap.main}:${jobId}`;
                const keys = [jobKey, this.keyMap.priority, this.keyMap.normal, this.keyMap.delay];
                
                const hashArgs = [];
                for (const [key, value] of Object.entries(serializedJob)) {
                    hashArgs.push(key, value == null || value === undefined ? " " : value.toString());
                }

                const args = [
                    jobId,
                    serializedJob.priority || "normal", 
                    serializedJob.delay || 0,
                    timestamp,
                    priorityOffset,
                    maxQueueSize,
                    ...hashArgs
                ];

                pipeline.addJobtoQueue(...keys, ...args);
            }

            const pipelineResults = await pipeline.exec();

            pipelineResults.forEach(([err, result], index) => {
                const originalJobId = chunk[index].id;

                if (err) {
                    failedCount++;
                    failedJobs.push({ id: originalJobId, reason: err.message });
                } else if (result === -1) {
                    failedCount++;
                    failedJobs.push({ id: originalJobId, reason: 'QueueFullError: Reached max capacity' });
                } else if (result === 0) {
                    successCount++;
                } else {
                    successCount++; 
                }
            });
        }

        return {
            totalAttempted: serializedJobsArray.length,
            successCount,
            failedCount,
            failedJobs
        };
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

    async addToFailed(jobId ,workerId , e){
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