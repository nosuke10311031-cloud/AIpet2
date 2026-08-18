import assert from "node:assert/strict";
import test from "node:test";
import { PET_STATES, PetStateMachine } from "../src/pet/state-machine.js";

test("state machine reports deterministic state changes", () => {
  const changes = [];
  const machine = new PetStateMachine({
    now: () => 1000,
    onChange: (change) => changes.push(change),
  });

  assert.equal(machine.currentState, PET_STATES.IDLE);
  assert.equal(machine.transition(PET_STATES.WALK, "test"), true);
  assert.equal(machine.currentState, PET_STATES.WALK);
  assert.equal(changes.at(-1).previous, PET_STATES.IDLE);
  assert.equal(changes.at(-1).reason, "test");
  assert.equal(machine.transition(PET_STATES.WALK), false);
});

test("interaction wakes a sleeping pet", () => {
  let now = 1000;
  const machine = new PetStateMachine({ now: () => now });

  machine.transition(PET_STATES.SLEEP, "test");
  now = 2000;
  machine.noteInteraction();

  assert.equal(machine.currentState, PET_STATES.IDLE);
  assert.equal(machine.lastInteractionAt, 2000);
});

test("unknown states are rejected", () => {
  const machine = new PetStateMachine();
  assert.throws(() => machine.transition("flying"), /Unknown pet state/);
});
