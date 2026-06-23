const {EventEmitter} = require("events");
const JobSubmitted = require("../domain/events/JobSubmitted");
const Job = require("../domain/Job");
const crypto = require("crypto");

class Queue extends EventEmitter {
    constructor(queueName , storageInstance , options={}){
        super();
        if(!queueName ) throw  new Error("Queue name is requried as a first argument");
        if(!storageInstance) throw new Error("Storage instance is required as a seconnd argument");
        this.queueName = queueName;
        this.storageInstance = storageInstance;
        this.maxQueueSize = options.maxQueueSize || 0;
        this.bulkChunkSize = options.bulkChunkSize || 1000;
    
    }

    async addJob(jobName, payload = {} , options = {}){
        if(!jobName) throw new Error("Job name is required");
        const jobId = options.jobId || crypto.randomUUID();

        // WHY: Redis is single-threaded. Saving a 5MB Base64 image in the payload will freeze the database.
        // HOW: We check the byte size of the payload before doing anything. Hard limit is 1MB.
        const payloadString = JSON.stringify(payload);
        const payloadSize = Buffer.byteLength(payloadString, 'utf8');
        if (payloadSize > 1024 * 1024) { // 1MB in bytes
            throw new Error(`PayloadTooLargeError: Payload is ${(payloadSize/1024/1024).toFixed(2)}MB. Limit is 1MB. Please store large data in S3/Cloud Storage and pass the URL instead.`);
        }


        const job = new Job({
            id :  jobId,
            name : jobName,
            payload,
            ...options
        });

        const serializedJob = job.toRedisHash();
        const result =  await this.storageInstance.addJobToQueue(serializedJob , { maxQueueSize: this.maxQueueSize });

        if (result === 0) {
            console.warn(`[Jiniq Warning] Job with ID ${jobId} already exists. Skipping duplicate insertion.`);
            return job; 
        }

        const jobSubmittedEvent = JobSubmitted.fromJob(job);
        this.emit("job:submitted", jobSubmittedEvent);
        return job;
    }
async addBulk(jobsArray) {
        if (!Array.isArray(jobsArray) || jobsArray.length === 0) {
            throw new Error("jobsArray must be a non-empty array");
        }

        const serializedJobs = [];
        const domainJobs = [];

        for (const item of jobsArray) {
            if(!item.name) throw new Error("Every bulk job must have a name");
            
            const payloadString = JSON.stringify(item.payload || {});
            if (Buffer.byteLength(payloadString, 'utf8') > 1024 * 1024) {
                throw new Error(`PayloadTooLargeError: Bulk job "${item.name}" exceeds 1MB limit. Bulk operation aborted.`);
            }

            const jobId = (item.options && item.options.jobId) ? item.options.jobId : crypto.randomUUID();
            
            const job = new Job({
                id: jobId,
                name: item.name,
                payload: item.payload || {},
                ...item.options
            });
            
            domainJobs.push(job);
            serializedJobs.push(job.toRedisHash());
        }

        const result = await this.storageInstance.addBulkJobs(serializedJobs, { 
            maxQueueSize: this.maxQueueSize,
            chunkSize: this.bulkChunkSize 
        });

        this.emit("jobs:submitted:bulk", { 
            count: result.successCount, 
            failedCount: result.failedCount,
            failedJobs: result.failedJobs 
        });

        return { ...result, jobs: domainJobs };
    }
    async close(){
        await this.storageInstance.shutdown();
    }
}

module.exports = Queue;