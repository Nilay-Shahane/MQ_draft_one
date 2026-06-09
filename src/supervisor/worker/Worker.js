const { EventEmitter } = require('events');
const Crypto = require('crypto');
const Supervisor = require('../Supervisor')

class Worker extends EventEmitter {
    
    constructor(queueName, processor, options = {}) {
        super();
        
        if (!queueName || typeof processor !== 'function') {
            throw new Error('Queue name and a processor function are strictly required.');
        }

        this._queueName = queueName;
        this._processor = processor;
        
        
        this._concurrency = options.concurrency || 1;
        this._lockDuration = options.lockDuration || 30000; 
        this._lockRenewTime = options.lockRenewTime || Math.floor(this._lockDuration / 2);
        this._stalledInterval = options.stalledInterval || 30000;
        this._maxStalledCount = options.maxStalledCount || 1;

        
        this._isRunning = false;
        this._isPaused = false;
        this._activeJobsCount = 0;

    }

    get id() {
        return this._id;
    }

    get queueName() {
        return this._queueName;
    }

    get concurrency() {
        return this._concurrency;
    }

    get lockDuration() {
        return this._lockDuration;
    }

    get isRunning() {
        return this._isRunning;
    }

    get isPaused() {
        return this._isPaused;
    }

    get activeJobsCount() {
        return this._activeJobsCount;
    }


} 

module.exports = Worker;