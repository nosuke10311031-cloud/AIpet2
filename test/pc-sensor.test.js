import assert from "node:assert/strict";
import test from "node:test";
import { PcSensor } from "../src/pc-sensor/pc-sensor.js";

test("PC Sensor emits only when the working context changes", async () => {
  const changes = [];
  const snapshots = [
    {
      currentContext: {
        application: "Codex",
        bundleId: "com.openai.codex",
        duration: 1,
      },
    },
    {
      currentContext: {
        application: "Codex",
        bundleId: "com.openai.codex",
        duration: 3,
      },
    },
    {
      currentContext: {
        application: "Google Chrome",
        bundleId: "com.google.Chrome",
        duration: 1,
      },
    },
  ];
  const sensor = new PcSensor({
    sample: async () => snapshots.shift(),
    onContextChange: (context) => changes.push(context.application),
    dispatch: () => {},
  });

  await sensor.tick();
  await sensor.tick();
  await sensor.tick();

  assert.deepEqual(changes, ["Codex", "Google Chrome"]);
  assert.equal(sensor.currentContext.bundleId, "com.google.Chrome");
});

test("PC Sensor prevents overlapping samples", async () => {
  let resolveSample;
  let calls = 0;
  const sensor = new PcSensor({
    sample: () => {
      calls += 1;
      return new Promise((resolve) => {
        resolveSample = resolve;
      });
    },
  });

  const first = sensor.tick();
  const second = sensor.tick();
  assert.equal(calls, 1);
  assert.equal(await second, null);

  resolveSample({ currentContext: null });
  await first;
});
