/**
 * BaseDB - Abstract Interface for JiNiQ Storage Engines
 * Ensuring consistency across different database implementations.
 */
class BaseDB {
    constructor() {
        if (this.constructor === BaseDB) {
            throw new Error("BaseDB is an abstract class and cannot be instantiated directly.");
        }
    }
    async maxRetriesDbConnect(times) {
        throw new Error("Method 'maxRetriesDbConnect()' must be implemented.");
    }

    async addToWaiting(job) {}

    async moveToDelayed(jobId, runAt) {}

    async addToActive(jobId) {}

    async claimJob(workerId, priorityOrder) {}   // LUA

    async completeJob(jobId) {}

    async failJob(jobId) {}

    async requeueStaleJobs() {} 
    
}