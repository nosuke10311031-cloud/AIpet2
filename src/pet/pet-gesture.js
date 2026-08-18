export const PET_DRAG_THRESHOLD_PX = 6;
export const PET_CLICK_MAX_DURATION_MS = 700;

export function pointerDistance(start, current) {
  return Math.hypot(current.x - start.x, current.y - start.y);
}

export function isShortPetClick({ start, end, elapsedMs }) {
  return (
    elapsedMs <= PET_CLICK_MAX_DURATION_MS &&
    pointerDistance(start, end) < PET_DRAG_THRESHOLD_PX
  );
}
