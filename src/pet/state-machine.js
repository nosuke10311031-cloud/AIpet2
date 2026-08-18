export const PET_STATES = Object.freeze({
  IDLE: "idle",
  WALK: "walk",
  SLEEP: "sleep",
  TALK: "talk",
});

const STATE_VALUES = new Set(Object.values(PET_STATES));

export class PetStateMachine {
  constructor({ onChange = () => {}, random = Math.random, now = Date.now } = {}) {
    this.currentState = PET_STATES.IDLE;
    this.previousState = null;
    this.onChange = onChange;
    this.random = random;
    this.now = now;
    this.lastInteractionAt = now();
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.emitChange("startup");
    this.scheduleNext();
  }

  stop() {
    this.running = false;
    this.clearTimer();
  }

  transition(nextState, reason = "manual") {
    if (!STATE_VALUES.has(nextState)) {
      throw new Error(`Unknown pet state: ${nextState}`);
    }
    if (nextState === this.currentState) return false;

    this.previousState = this.currentState;
    this.currentState = nextState;

    if (nextState === PET_STATES.IDLE && this.previousState === PET_STATES.SLEEP) {
      this.lastInteractionAt = this.now();
    }

    this.emitChange(reason);
    if (this.running) this.scheduleNext();
    return true;
  }

  noteInteraction() {
    this.lastInteractionAt = this.now();
    if (this.currentState === PET_STATES.SLEEP) {
      this.transition(PET_STATES.IDLE, "user-interaction");
    }
  }

  talk(durationMs = 5000) {
    this.transition(PET_STATES.TALK, "conversation-started");
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.transition(PET_STATES.IDLE, "conversation-finished");
    }, durationMs);
  }

  emitChange(reason) {
    this.onChange({
      current: this.currentState,
      previous: this.previousState,
      reason,
      changedAt: this.now(),
    });
  }

  scheduleNext() {
    this.clearTimer();

    let delay;
    let nextState;

    switch (this.currentState) {
      case PET_STATES.WALK:
        delay = 4200 + this.random() * 3200;
        nextState = PET_STATES.IDLE;
        break;
      case PET_STATES.SLEEP:
        delay = 8000 + this.random() * 5000;
        nextState = PET_STATES.IDLE;
        break;
      case PET_STATES.TALK:
        return;
      case PET_STATES.IDLE:
      default: {
        delay = 3800 + this.random() * 3600;
        const inactiveFor = this.now() - this.lastInteractionAt;
        nextState =
          inactiveFor >= 24000 ? PET_STATES.SLEEP : PET_STATES.WALK;
        break;
      }
    }

    this.timer = setTimeout(() => {
      this.transition(nextState, "autonomous-behavior");
    }, delay);
  }

  clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
