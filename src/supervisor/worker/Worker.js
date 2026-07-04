const Supervisor = require('./Supervisor');
const JobExecutor = require('./JobExecutor');
const HeartBeat = require('./HeartBeat');
const Sweeper = require('./worker/Sweeper');
const RedisStorage = require('../infrastructure/db/RedisStorage'); 

class Worker {
    constructor(queueName, processor, options = {}) {
        if (!queueName || typeof processor !== 'function') {
            throw new Error('Queue name and processor function are required.');
        }

        const concurrency = options.concurrency || 1;
        const ttl = options.lockDuration || 30000; 
        const sweeperInterval = options.stalledInterval || 30000;

        const storage = new RedisStorage(queueName, options.redis);
        const sweeper = new Sweeper(storage, sweeperInterval);

        this.supervisor = new Supervisor({
            name: queueName,
            JobExecutor: JobExecutor,
            Heartbeat: HeartBeat,
            userProcess: processor,
            maxConcurrency: concurrency,
            storage: storage,
            sweeper: sweeper,
            ttl: ttl,
            maxTimeoutMs: options.maxTimeoutMs || 300000,
            priorityOffset: options.priorityOffset || 0,
            sweeperInterval: sweeperInterval
        });
    }

    start() {
        this.supervisor.start();
        console.log(`Worker for queue ${this.supervisor.name} started.`);
    }
} 

module.exports = Worker;