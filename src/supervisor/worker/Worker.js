const { EventEmitter } = require('events');
const RedisDB = require('../../infrastructure/db/RedisDB');
const RedisStorage = require('../../infrastructure/db/RedisStorage');
const Supervisor = require('../Supervisor');
const Sweeper = require('./Sweeper');
const JobExecutor = require('./JobExecutor');
const HeartBeat = require('./HeartBeat');
const QueueStateManager = require('../../queue/QueueStateManager');

class Worker extends EventEmitter {
    #storageInstance;

    constructor(queueName, processorFn, options = {}) {
        super();
        
        if (!queueName || typeof processorFn !== 'function') {
            throw new Error('Jiniq Worker: Queue name and a processor function are strictly required.');
        }

        this.queueName = queueName;
        
        const redisConfig = options.redisConfig || {};
        const manager = new RedisDB(redisConfig);
        const fetcher = new RedisDB(redisConfig);
        
        this.#storageInstance = new RedisStorage(queueName, manager, fetcher, redisConfig);

     
        this.sweeper = new Sweeper(this.#storageInstance, options.sweeperInterval || 30000);
        
    
        this.stateManager = new QueueStateManager(this.#storageInstance);

        this.supervisor = new Supervisor({
            name: queueName,
            JobExecutor: JobExecutor,
            Heartbeat: HeartBeat,
            userProcess: processorFn,
            maxConcurrency: options.concurrency || 1,
            storage: this.#storageInstance,
            sweeper: this.sweeper,
            stateManager: this.stateManager, // Injected here!
            ttl: options.lockDuration || 30000,
            priorityOffset: options.priorityOffset || 10000,
            sweeperInterval: options.sweeperInterval || 30000,
            maxTimeoutMs: options.maxTimeoutMs || 300000 
        });
        this.supervisor.on('job:completed', (data) => {
            this.emit('job:completed', data);
        });

        this.supervisor.on('job:failed', (data) => {
            this.emit('job:failed', data);
        });
    }

    async start() {
        console.log(`[Jiniq Worker] Booting up consumer for queue "${this.queueName}"...`);
        await this.supervisor.start();
    }

    async stop() {
        console.log(`[Jiniq Worker] Initiating graceful shutdown...`);
        await this.supervisor.stop();
        await this.#storageInstance.shutdown();
        console.log(`[Jiniq Worker] Offline.`);
    }
} 

module.exports = Worker;