const Redis = require('ioredis');
const BaseDB = require('./BaseDB');
const fs = require("fs");
const path = require("path");

const waitToActiveLua = fs.readFileSync(
  path.join(__dirname, "../lua/ClaimNextJob.lua"),
  "utf8"
);

class RedisDB extends BaseDB {
    
    constructor(config = {}) {
        super();    
        this.keyMap = {
            priority: 'jiniq-draft:PrioQ',
            normal: 'jiniq-draft:NormalQ',
            active:  'jiniq-draft:ActiveQ',
            lock:    'jiniq-draft:Lock'
        };

        this.client = new Redis({
            host: config.host || '127.0.0.1',
            port: config.port || 6379,
            retryStrategy: (times) => this.maxRetriesDbConnect(times),
            ...config
        });

       this.client.defineCommand('claimNextJob', {
        numberOfKeys: 4,
        lua: waitToActiveLua
    });

        this.client.defineCommand('renewJobLease' , {
            numberOfKeys : 1,
            lua : checkAndUpdateHeartbeatLua
        })
    
    }



    async maxRetriesDbConnect(times) {
        return Math.min(times * 100, 3000);
    }

   
    // ---------------- CLAIM JOB ----------------
    async fromWaitingToActive(jobJson) {
        const {ttl = 30000 , priorityOffset = 10000 , workerId } = jobJson
        const keys = [
            this.keyMap.priority,
            this.keyMap.normal , 
            this.keyMap.active,
            this.keyMap.lock
        ];

        const timestamp = Date.now();

        return await this.client.claimNextJob(...keys , ttl , timestamp , priorityOffset , workerId);
    }

    async checkAndUpdateHeartbeat(jobJson) {
        const {heartbeat , jobId , workerId} = jobJson
        const keys = [
            this.keyMap.lock
        ]
        return await this.client.renewJobLease(...keys , jobId , workerId , heartbeat)
    }
    
}

module.exports = RedisDB;