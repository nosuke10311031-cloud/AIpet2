import assert from "node:assert/strict";
import test from "node:test";
import { PetBehaviorEngine } from "../src/behavior/behavior-engine.js";
import { PET_STATES, PetStateMachine } from "../src/pet/state-machine.js";

function snapshot({
  application = "Codex",
  bundleId = "com.openai.codex",
  duration = 1,
} = {}) {
  return { currentContext: { application, bundleId, duration } };
}

test("development context makes Mochi idle nearby", () => {
  const bubbles = [];
  const machine = new PetStateMachine();
  machine.transition(PET_STATES.WALK, "test");
  const engine = new PetBehaviorEngine({
    stateMachine: machine,
    showBubble: (content) => bubbles.push(content),
    now: () => 1000,
  });

  assert.equal(engine.update(snapshot()), "development-context");
  assert.equal(machine.currentState, PET_STATES.IDLE);
  assert.match(bubbles[0], /見守る/);
});

test("sustained focus has priority and starts a rest animation", () => {
  const machine = new PetStateMachine();
  const engine = new PetBehaviorEngine({
    stateMachine: machine,
    now: () => 1000,
  });

  assert.equal(
    engine.update(snapshot({ duration: 25 * 60 })),
    "sustained-focus",
  );
  assert.equal(machine.currentState, PET_STATES.SLEEP);
});

test("behavior rules never interrupt a conversation", () => {
  const machine = new PetStateMachine();
  machine.transition(PET_STATES.TALK, "test");
  const engine = new PetBehaviorEngine({ stateMachine: machine });

  assert.equal(engine.update(snapshot({ duration: 30 * 60 })), null);
  assert.equal(machine.currentState, PET_STATES.TALK);
});

test("switching ordinary apps makes Mochi walk", () => {
  const machine = new PetStateMachine();
  const engine = new PetBehaviorEngine({ stateMachine: machine });
  engine.update(
    snapshot({ application: "Safari", bundleId: "com.apple.Safari" }),
  );

  assert.equal(
    engine.update(
      snapshot({ application: "Finder", bundleId: "com.apple.finder" }),
    ),
    "application-switch",
  );
  assert.equal(machine.currentState, PET_STATES.WALK);
});
