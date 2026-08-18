import { PET_STATES } from "./state-machine.js";

const DEFAULT_CHARACTER = {
  name: "Mochi",
  initialState: PET_STATES.IDLE,
  states: {
    idle: { asset: "/characters/mochi/idle.svg" },
    walk: { asset: "/characters/mochi/walk.svg" },
    sleep: { asset: "/characters/mochi/sleep.svg" },
    talk: { asset: "/characters/mochi/talk.svg" },
  },
};

export async function loadCharacter() {
  try {
    const response = await fetch("/characters/mochi/character.json");
    if (!response.ok) throw new Error(`character config: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Using the built-in character fallback", error);
    return DEFAULT_CHARACTER;
  }
}

export class PetCharacterRenderer {
  constructor({ character }) {
    this.character = character;
    this.state = character.initialState ?? PET_STATES.IDLE;
    this.direction = "left";
    this.pet = null;
    this.sprite = null;
  }

  mount() {
    this.pet = document.querySelector("#pet");
    this.sprite = document.querySelector("#pet-sprite");
    this.setState(this.state);
    this.setDirection(this.direction);
    this.pet.setAttribute(
      "aria-label",
      `${this.character.name ?? "AIペット"}。クリックで会話、ドラッグで移動`,
    );
  }

  setState(state) {
    this.state = state;
    if (!this.pet || !this.sprite) return;

    const stateConfig =
      this.character.states?.[state] ?? DEFAULT_CHARACTER.states[state];
    if (!stateConfig) return;

    this.sprite.src = stateConfig.asset;
    this.pet.dataset.state = state;
    this.pet.classList.remove(
      "pet--idle",
      "pet--walk",
      "pet--sleep",
      "pet--talk",
    );
    this.pet.classList.add(`pet--${state}`);
  }

  setDirection(direction) {
    if (direction !== "left" && direction !== "right") return;
    this.direction = direction;
    if (!this.pet) return;
    this.pet.classList.toggle("pet--facing-left", direction === "left");
    this.pet.classList.toggle("pet--facing-right", direction === "right");
  }

  hideBubble() {
    document.querySelector("#speech-bubble")?.classList.add("speech-bubble--hidden");
  }

  showBubble(content, durationMs = 5000) {
    const bubble = document.querySelector("#speech-bubble");
    const text = document.querySelector("#speech-text");
    if (!bubble || !text) return;

    const compact = content.replace(/\s+/g, " ").trim();
    text.textContent = compact.length > 52 ? `${compact.slice(0, 51)}…` : compact;
    bubble.classList.remove("speech-bubble--hidden");
    window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.hideBubble(), durationMs);
  }
}
