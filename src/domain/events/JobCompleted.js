const BaseEvent = require('./BaseEvent');

class JobCompleted extends BaseEvent {
  #jobId;
  #workerId;
  #attempt;
  #result;
  #duration;

  constructor({ jobId, workerId, attempt, result, duration }) {
    super("JOB_COMPLETED");

    if (!jobId) throw new Error("jobId required");
    if (!workerId) throw new Error("workerId required");

    this.#jobId = jobId;
    this.#workerId = workerId;
    this.#attempt = attempt;
    this.#result = result ?? null;
    this.#duration = duration ?? null;

    Object.freeze(this);
  }

  static fromJob(job, workerId, result, duration) {
    return new JobCompleted({
      jobId: job.id,
      workerId,
      attempt: job.attempt,
      result,
      duration
    });
  }

  toJSON() {
    return {
      ...super.baseJSON(),
      jobId: this.#jobId,
      workerId: this.#workerId,
      attempt: this.#attempt,
      result: this.#result,
      duration: this.#duration
    };
  }
}

module.exports = JobCompleted;