const IdGenerator = require('../utils/IdGenerator');
class QueueStateManager {
    constructor(storage) {
        this.storage = storage;
    }
    fetchJob = async (ttl = 30000, priorityOffset = 10000) => {
        const workerId = IdGenerator.generate();
        const jobId = await this.storage.fromWaitingToActive({
            ttl: ttl,
            priorityOffset: priorityOffset,
            workerId: workerId,
        });
        
        if (!jobId) return null;
        return { jobId, workerId };
    }
}

module.exports = QueueStateManager;