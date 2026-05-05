const BaseEvent = require('./BaseEvent');

class JobStaleFound extends BaseEvent {
  #jobId;
  #workerId;
  #lastStartedAt;
  #staleFor;

  constructor({ jobId, workerId, lastStartedAt, staleFor }) {
    super("JOB_STALE_FOUND");

    if (!jobId) throw new Error("jobId required");

    this.#jobId = jobId;
    this.#workerId = workerId;
    this.#lastStartedAt = lastStartedAt;
    this.#staleFor = staleFor;

    Object.freeze(this);
  }

  static fromJob(job, workerId) {
    const staleFor = Date.now() - job.startedAt;

    return new JobStaleFound({
      jobId: job.id,
      workerId,
      lastStartedAt: job.startedAt,
      staleFor
    });
  }

  toJSON() {
    return {
      ...super.baseJSON(),
      jobId: this.#jobId,
      workerId: this.#workerId,
      lastStartedAt: this.#lastStartedAt,
      staleFor: this.#staleFor
    };
  }
}

module.exports = JobStaleFound;