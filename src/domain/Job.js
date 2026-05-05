const JobStatus = require('./JobStatus')
class Job {
  #id;
  #name;
  #payload;
  #priority;
  #runAt;
  #status;
  #attempt;
  #maxAttempts;
  #delay;

  #createdAt;
  #updatedAt;
  #startedAt;
  #completedAt;
  #failedAt;
  #deadAt;

  #result;
  #failedReason;
  #stackTrace;
  #workerId;
  #finishedOn;

  constructor({
    id,
    name,
    payload = {},
    priority = "normal",
    delay = null,
    runAt = null,
    maxAttempts = 0
  } = {}) {

    if (!id) throw new Error("Job must have id");
    if (!name) throw new Error("Job must have name");

    // assign to private fields
    this.#id = id;
    this.#name = name;
    this.#payload = payload;
    this.#priority = priority;
    this.#delay = delay;
    this.#runAt = runAt;

    // state
    this.#status = JobStatus.WAITING;
    this.#attempt = 0;
    this.#maxAttempts = maxAttempts;

    // timestamps
    this.#createdAt = Date.now();
    this.#updatedAt = Date.now();
    this.#startedAt = null;
    this.#completedAt = null;
    this.#failedAt = null;
    this.#deadAt = null;

    // execution metadata
    this.#result = null;
    this.#failedReason = null;
    this.#stackTrace = null;
    this.#workerId = null;
    this.#finishedOn = null;
  }


  get id() { return this.#id; }
  get name() { return this.#name; }
  get payload() {return this.#payload}
  get priority() { return this.#priority; }
  get delay() {return this.#delay}
  get runAt() { return this.#runAt; }

  get status() { return this.#status; }
  get attempt() { return this.#attempt; }
  get maxAttempts() {return this.#maxAttempts;}

  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }
  get startedAt() { return this.#startedAt; }
  get completedAt() { return this.#completedAt; }
  get failedAt() { return this.#failedAt; }
  get deadAt() { return this.#deadAt; }

  get result() { return this.#result; }
  get failedReason() { return this.#failedReason; }
  get stackTrace() { return this.#stackTrace; }
  get workerId() { return this.#workerId; }
  get finishedOn() { return this.#finishedOn; }

}

module.exports = Job