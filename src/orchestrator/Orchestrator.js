class Orchestrator {
  constructor({ Queue , ActiveQ , claimHandler, interval = 5000 }) {
    this.claimHandler = claimHandler;
    this.interval = interval;
    this.timer = null;
  }

  start() {
    this.claimHandler.startFetchOperation();

    this.timer = setInterval(() => {
      this.claimHandler.startFetchOperation();
    }, this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}