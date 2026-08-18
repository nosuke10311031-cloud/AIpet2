import assert from "node:assert/strict";
import test from "node:test";
import {
  isShortPetClick,
  PET_DRAG_THRESHOLD_PX,
  pointerDistance,
} from "../src/pet/pet-gesture.js";

test("short stationary gestures are clicks", () => {
  assert.equal(
    isShortPetClick({
      start: { x: 10, y: 10 },
      end: { x: 12, y: 13 },
      elapsedMs: 220,
    }),
    true,
  );
});

test("movement at the drag threshold is not a click", () => {
  assert.equal(pointerDistance({ x: 0, y: 0 }, { x: 6, y: 0 }), 6);
  assert.equal(
    isShortPetClick({
      start: { x: 0, y: 0 },
      end: { x: PET_DRAG_THRESHOLD_PX, y: 0 },
      elapsedMs: 120,
    }),
    false,
  );
});
