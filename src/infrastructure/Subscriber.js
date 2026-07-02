const Redis = require('ioredis');
const { EventEmitter } = require('events');

class Subscriber extends EventEmitter {
    constructor(queueName, config = {}) {
        super();
          
        this.channel = `jiniq-draft:${queueName}:notify`; 
    
        this.client = new Redis({
            host: config.host || '127.0.0.1',
            port: config.port || 6379,
            ...config
        });

        this.client.on('error', (err) => console.error(`[Subscriber Error]:`, err));
        
    } 
    async listen() {
        await this.client.subscribe(this.channel);

        // Whenever the Lua script rings the doorbell, this triggers
        this.client.on('message', (channel, message) => {
            if (channel === this.channel) {

                this.emit('new-job', message); 
            }
        });
    }

    
    async close() {
        await this.client.unsubscribe(this.channel);
        await this.client.quit();
    }
}

module.exports = Subscriber;