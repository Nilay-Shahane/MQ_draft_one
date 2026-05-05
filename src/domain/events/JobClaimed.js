const BaseEvent = require('./BaseEvent');

class JobClaimed extends BaseEvent {
  #jobId;
  #workerId;
  #attempt;

  constructor({ jobId, workerId, attempt }) {
    super("JOB_CLAIMED");

    if (!jobId) throw new Error("jobId required");
    if (!workerId) throw new Error("workerId required");

    this.#jobId = jobId;
    this.#workerId = workerId;
    this.#attempt = attempt ?? 0;

    Object.freeze(this);
  }

  static fromJob(job, workerId) {
    return new JobClaimed({
      jobId: job.id,
      workerId,
      attempt: job.attempt
    });
  }

  toJSON() {
    return {
      ...super.baseJSON(),
      jobId: this.#jobId,
      workerId: this.#workerId,
      attempt: this.#attempt
    };
  }
}

module.exports = JobClaimed;