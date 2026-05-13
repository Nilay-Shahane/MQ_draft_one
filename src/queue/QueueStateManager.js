const RedisDB = require('../infrastructure/db/RedisDB')
const { randomUUID } = require('node:crypto');
class QueueStateManager{
    constructor(){

    }
    workerIdGenerator = async () =>{    
        return randomUUID();
    }


    fetchJob = async () =>{
        const workerId = await this.workerIdGenerator()
        const jobId = await this.fromWaitingToActive({
            ttl:3000,
            priorityOffset : 10000 ,
            workerId : workerId,
        })
        return jobId
    }
    
}

module.exports = QueueStateManager