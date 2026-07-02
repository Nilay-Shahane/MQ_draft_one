local activeQ = KEYS[1]
local delayQ = KEYS[2] 
local deadQ = KEYS[3]

local lockPrefix = ARGV[1]
local jobHashPrefix = ARGV[2]

-- Get all jobs currently in the active queue
local activeJobs = redis.call('LRANGE', activeQ, 0, -1)
local sweptCount = 0

for _, payload in ipairs(activeJobs) do
    -- Extract jobId from the "jobId:workerId" payload
    local splitIndex = string.find(payload, ":")
    if splitIndex then
        local jobId = string.sub(payload, 1, splitIndex - 1)
        
        local lockKey = lockPrefix .. ":" .. jobId
        local jobHashKey = jobHashPrefix .. ":" .. jobId
        
        -- If the lock is missing, the heartbeat flatlined (Worker crashed)
        if redis.call('EXISTS', lockKey) == 0 then
            
            -- 1. Remove from active queue
            redis.call('LREM', activeQ, 0, payload)
            
            -- 2. Atomically increment the attempt counter
            local currAttempt = redis.call('HINCRBY', jobHashKey, 'currAttempt', 1)
            local maxAttempt = tonumber(redis.call('HGET', jobHashKey, 'maxAttempt') or 0)
            
            -- 3. Route based on attempts
            if currAttempt <= maxAttempt then
                -- Push to delayed queue (Partner's code handles the routing from here)
                redis.call('RPUSH', delayQ, jobId)
            else
                -- Max attempts reached, push to dead letter queue
                redis.call('RPUSH', deadQ, jobId)
            end
            
            sweptCount = sweptCount + 1
        end
    end
end

return sweptCount