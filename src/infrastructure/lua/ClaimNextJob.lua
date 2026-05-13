
-- ARGV

local ttl      = tonumber(ARGV[1])
local now      = tonumber(ARGV[2])
local offset   = tonumber(ARGV[3]) or 10000   
local workerId = ARGV[4]



local prioData = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local normData = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')

local jobId = nil
local source = nil



if #prioData > 0 and #normData > 0 then
    local prioId    = prioData[1]
    local prioScore = tonumber(prioData[2])

    local normId    = normData[1]
    local normScore = tonumber(normData[2])


    if (prioScore - offset) <= normScore then
        jobId = prioId
        source = KEYS[1]
    else
        jobId = normId
        source = KEYS[2]
    end

elseif #prioData > 0 then
    jobId = prioData[1]
    source = KEYS[1]

elseif #normData > 0 then
    jobId = normData[1]
    source = KEYS[2]
end

if jobId then
    local jobScore = tonumber(redis.call('ZSCORE', source, jobId))

    
    if jobScore > now then
        return nil
    end

    local jobKey = KEYS[4] .. ":" .. jobId 


    if redis.call('EXISTS', jobKey) == 1 then
        return 0
    end

    -- Move to active queue
    redis.call('RPUSH', KEYS[3], jobId .. ":" .. workerId) 

    -- Set lock with TTL
    redis.call('PSETEX', jobKey, ttl, workerId)  

    -- Remove from source queue
    redis.call('ZREM', source, jobId)

    return jobId
end

return nil