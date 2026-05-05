const BaseEvent = require('./BaseEvent');

class JobFailed extends BaseEvent {
  #jobId;
  #workerId;
  #attempt;
  #failedReason;
  #stackTrace;

  constructor({ jobId, workerId, attempt, failedReason, stackTrace }) {
    super("JOB_FAILED");

    if (!jobId) throw new Error("jobId required");
    if (!workerId) throw new Error("workerId required");
    if (!failedReason) throw new Error("failedReason required");

    this.#jobId = jobId;
    this.#workerId = workerId;
    this.#attempt = attempt;
    this.#failedReason = failedReason;
    this.#stackTrace = stackTrace ?? null;

    Object.freeze(this);
  }

  static fromJob(job, workerId, error) {
    return new JobFailed({
      jobId: job.id,
      workerId,
      attempt: job.attempt,
      failedReason: error.message,
      stackTrace: error.stack
    });
  }

  toJSON() {
    return {
      ...super.baseJSON(),
      jobId: this.#jobId,
      workerId: this.#workerId,
      attempt: this.#attempt,
      failedReason: this.#failedReason,
      stackTrace: this.#stackTrace
    };
  }
}

module.exports = JobFailed;