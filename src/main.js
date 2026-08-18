import { emitTo, listen } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getAllWindows,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { PetBehaviorEngine } from "./behavior/behavior-engine.js";
import { loadCharacter, PetCharacterRenderer } from "./pet/character-renderer.js";
import {
  isShortPetClick,
  PET_DRAG_THRESHOLD_PX,
  pointerDistance,
} from "./pet/pet-gesture.js";
import { PetPhysicsController } from "./pet/physics-controller.js";
import { PET_STATES, PetStateMachine } from "./pet/state-machine.js";
import { PcSensor } from "./pc-sensor/pc-sensor.js";

async function openChatWindow(stateMachine) {
  stateMachine.noteInteraction();
  stateMachine.transition(PET_STATES.TALK, "chat-opened");

  const windows = await getAllWindows();
  const chatWindow = windows.find((window) => window.label === "chat");
  if (!chatWindow) throw new Error("Chat window is unavailable");

  const petWindow = getCurrentWindow();
  const [petPosition, petSize, chatSize, monitor] = await Promise.all([
    petWindow.outerPosition(),
    petWindow.outerSize(),
    chatWindow.outerSize(),
    currentMonitor(),
  ]);

  if (monitor) {
    const { position, size } = monitor.workArea;
    const preferredX = petPosition.x + (petSize.width - chatSize.width) / 2;
    const preferredY = petPosition.y - chatSize.height + 42 * monitor.scaleFactor;
    const x = Math.min(
      Math.max(preferredX, position.x),
      position.x + size.width - chatSize.width,
    );
    const y = Math.min(
      Math.max(preferredY, position.y),
      position.y + size.height - chatSize.height,
    );
    await chatWindow.setPosition(
      new PhysicalPosition(Math.round(x), Math.round(y)),
    );
  }

  await chatWindow.show();
  await chatWindow.setFocus();
  await emitTo("chat", "chat:focus-input");
}

function enableWindowDragging({ physics, stateMachine }) {
  const pet = document.querySelector("#pet");
  const appWindow = getCurrentWindow();
  let gesture = null;
  let chatOpening = false;
  let lastChatOpenedAt = -Infinity;

  async function requestChat() {
    const requestedAt = performance.now();
    if (chatOpening || requestedAt - lastChatOpenedAt < 500) return;

    chatOpening = true;
    lastChatOpenedAt = requestedAt;
    try {
      await openChatWindow(stateMachine);
    } catch (error) {
      console.error("Could not open the chat window", error);
    } finally {
      chatOpening = false;
    }
  }

  pet.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stateMachine.noteInteraction();
    gesture = {
      pointerId: event.pointerId,
      start: { x: event.screenX, y: event.screenY },
      startedAt: performance.now(),
      dragging: false,
    };
    pet.setPointerCapture(event.pointerId);
  });

  pet.addEventListener("pointermove", async (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.dragging) {
      return;
    }

    const current = { x: event.screenX, y: event.screenY };
    if (pointerDistance(gesture.start, current) < PET_DRAG_THRESHOLD_PX) return;

    gesture.dragging = true;
    physics.beginDrag();
    try {
      await appWindow.startDragging();
    } catch (error) {
      console.error("Could not drag the pet window", error);
    } finally {
      try {
        await physics.releaseFromDrag();
      } catch (error) {
        console.error("Could not release the pet window", error);
      }
      gesture = null;
    }
  });

  pet.addEventListener("pointerup", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const wasClick =
      !gesture.dragging &&
      isShortPetClick({
        start: gesture.start,
        end: { x: event.screenX, y: event.screenY },
        elapsedMs: performance.now() - gesture.startedAt,
      });
    gesture = null;
    if (wasClick) void requestChat();
  });

  pet.addEventListener("pointercancel", () => {
    if (!gesture?.dragging) gesture = null;
  });

  pet.addEventListener("click", (event) => {
    if (event.detail === 0) void requestChat();
  });
}

function enablePetMenu() {
  const pet = document.querySelector("#pet");
  const menu = document.querySelector("#pet-menu");
  const quitButton = document.querySelector("#quit-pet");

  pet.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    menu.style.left = `${Math.min(event.clientX, 148)}px`;
    menu.style.top = `${Math.min(event.clientY, 168)}px`;
    menu.classList.remove("pet-menu--hidden");
    quitButton.focus();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) menu.classList.add("pet-menu--hidden");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.classList.add("pet-menu--hidden");
      pet.focus();
    }
  });

  quitButton.addEventListener("click", async () => {
    const windows = await getAllWindows();
    await Promise.all(windows.map((window) => window.close()));
  });
}

function startAutonomousJumps({ physics, stateMachine }) {
  return window.setInterval(() => {
    if (
      stateMachine.currentState === PET_STATES.WALK &&
      Math.random() < 0.45
    ) {
      physics.jump();
    }
  }, 4200);
}

async function startPetView() {
  const character = await loadCharacter();
  const renderer = new PetCharacterRenderer({ character });
  const physics = new PetPhysicsController({
    onDirectionChange: (direction) => renderer.setDirection(direction),
  });
  const stateMachine = new PetStateMachine({
    onChange: ({ current }) => {
      renderer.setState(current);
      physics.setState(current);
    },
  });

  renderer.mount();
  await physics.start();
  stateMachine.start();
  const behaviorEngine = new PetBehaviorEngine({
    stateMachine,
    showBubble: (content, duration) =>
      renderer.showBubble(content, duration),
  });
  const pcSensor = new PcSensor({
    onSnapshot: (snapshot) => behaviorEngine.update(snapshot),
  });
  pcSensor.start();

  enableWindowDragging({ physics, stateMachine });
  enablePetMenu();
  const jumpTimer = startAutonomousJumps({ physics, stateMachine });
  const unlistenVisibility = await listen("chat:visibility", ({ payload }) => {
    if (payload?.open) {
      stateMachine.transition(PET_STATES.TALK, "chat-opened");
    } else if (stateMachine.currentState === PET_STATES.TALK) {
      stateMachine.transition(PET_STATES.IDLE, "chat-closed");
    }
  });
  const unlistenReply = await listen("chat:reply", ({ payload }) => {
    if (typeof payload?.content === "string") {
      renderer.showBubble(payload.content, 6500);
    }
  });

  window.setTimeout(() => renderer.hideBubble(), 2800);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(jumpTimer);
    unlistenVisibility();
    unlistenReply();
    stateMachine.stop();
    physics.stop();
    pcSensor.stop();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "chat") {
    const { startChatView } = await import("./chat/chat-view.js");
    await startChatView();
  } else {
    await startPetView();
  }
});
