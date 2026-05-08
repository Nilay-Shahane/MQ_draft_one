const Redis = require('ioredis');
const BaseDB = require('./BaseDB');

class RedisDB extends BaseDB {
    constructor(config = {}) {
        super();

        this.keyMap = {
            priority: 'jiniq-draft:PrioQ',
            normal: 'jiniq-draft:NormalQ',
            active:  'jiniq-draft:ActiveQ',
            lock:    'jiniq-draft:lock'
        };

        this.client = new Redis({
            host: config.host || '127.0.0.1',
            port: config.port || 6379,
            retryStrategy: (times) => this.maxRetriesDbConnect(times),
            ...config
        });

        this.client.defineCommand('getNextJob', {
            numberOfKeys: 3,
            lua: `
                local source = 1
                local job = redis.call('ZRANGE', KEYS[1], 0, 0)

                if #job == 0 then
                    job = redis.call('ZRANGE', KEYS[2], 0, 0)
                    source = 2
                end

                if #job > 0 then
                    local jobId = job[1]

                    if source == 1 then
                        redis.call('ZREM', KEYS[1], jobId)
                    else
                        redis.call('ZREM', KEYS[2], jobId)
                    end

                    -- move to active queue
                    redis.call('ZADD', KEYS[3], ARGV[1], jobId)

                    return jobId
                end

                return nil
            `
        });
    }

    async maxRetriesDbConnect(times) {
        return Math.min(times * 100, 3000);
    }

    // ---------------- HASH ----------------
    async hashSet({ name, field, value, data }) {
        if (data) {
            return await this.client.hset(name, data);
        }
        return await this.client.hset(name, field, value);
    }

    async hashGet({ name }) {
        return await this.client.hgetall(name);
    }

    // ---------------- ZSET ----------------
    async zsetAdd({ name, score, member }) {
        return await this.client.zadd(name, score, member);
    }

    async zsetRem({ name, member }) {
        return await this.client.zrem(name, member);
    }

    async zsetRead({ name, maxScore = Date.now() }) {
        return await this.client.zrangebyscore(name, '-inf', maxScore);
    }

    // ---------------- LIST ----------------
    async listPush({ name, value }) {
        return await this.client.lpush(name, value);
    }

    async listPop({ name }) {
        return await this.client.rpop(name);
    }

    // ---------------- STREAM ----------------
    async streamAdd({ name, data }) {
        return await this.client.xadd(
            name,
            '*',
            'payload',
            JSON.stringify(data)
        );
    }

    async streamRead({ name, count = 10, lastId = '0' }) {
        return await this.client.xread(
            'COUNT',
            count,
            'STREAMS',
            name,
            lastId
        );
    }

    // ---------------- CLAIM JOB ----------------
    async claimNextJob({ fromQueues, toQueue }) {
        const keys = [
            this.keyMap[fromQueues[0]],
            this.keyMap[fromQueues[1]],
            this.keyMap[toQueue]
        ];

        const timestamp = Date.now();

        return await this.client.getNextJob(...keys, timestamp);
    }
}

module.exports = RedisDB;