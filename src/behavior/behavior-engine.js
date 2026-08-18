import { PET_STATES } from "../pet/state-machine.js";

const DEVELOPMENT_BUNDLE_PREFIXES = [
  "com.openai.codex",
  "com.microsoft.VSCode",
  "com.apple.dt.Xcode",
  "com.jetbrains.",
  "dev.zed.Zed",
];

export const DEFAULT_BEHAVIOR_RULES = Object.freeze([
  {
    id: "sustained-focus",
    priority: 100,
    cooldownMs: 90 * 60 * 1000,
    matches: ({ context }) => context.duration >= 25 * 60,
    action: {
      state: PET_STATES.SLEEP,
      bubble: "ずっと集中してるね。少しだけ休憩してもいいかも。",
      bubbleDurationMs: 8000,
    },
  },
  {
    id: "development-context",
    priority: 50,
    cooldownMs: 5 * 60 * 1000,
    matches: ({ context, contextChanged }) =>
      contextChanged &&
      DEVELOPMENT_BUNDLE_PREFIXES.some((prefix) =>
        context.bundleId.startsWith(prefix),
      ),
    action: {
      state: PET_STATES.IDLE,
      bubble: "集中してるね。Mochiはそばで見守るよ。",
      bubbleDurationMs: 6000,
    },
  },
  {
    id: "application-switch",
    priority: 10,
    cooldownMs: 3000,
    matches: ({ contextChanged, hadPreviousContext }) =>
      contextChanged && hadPreviousContext,
    action: {
      state: PET_STATES.WALK,
    },
  },
]);

export class PetBehaviorEngine {
  constructor({
    stateMachine,
    showBubble = () => {},
    rules = DEFAULT_BEHAVIOR_RULES,
    now = Date.now,
  }) {
    this.stateMachine = stateMachine;
    this.showBubble = showBubble;
    this.rules = [...rules].sort((a, b) => b.priority - a.priority);
    this.now = now;
    this.lastBundleId = null;
    this.lastTriggeredAt = new Map();
  }

  update(snapshot) {
    const context = snapshot?.currentContext;
    if (!context?.bundleId) return null;

    const previousBundleId = this.lastBundleId;
    const contextChanged = context.bundleId !== previousBundleId;
    const hadPreviousContext = previousBundleId !== null;
    this.lastBundleId = context.bundleId;

    if (this.stateMachine.currentState === PET_STATES.TALK) return null;

    const evaluatedAt = this.now();
    const rule = this.rules.find((candidate) => {
      const lastTriggeredAt = this.lastTriggeredAt.get(candidate.id) ?? -Infinity;
      const cooldownElapsed =
        evaluatedAt - lastTriggeredAt >= candidate.cooldownMs;
      return (
        cooldownElapsed &&
        candidate.matches({ context, contextChanged, hadPreviousContext, snapshot })
      );
    });

    if (!rule) return null;
    this.lastTriggeredAt.set(rule.id, evaluatedAt);
    this.stateMachine.transition(
      rule.action.state,
      `pc-context:${rule.id}`,
    );

    if (rule.action.bubble) {
      this.showBubble(
        rule.action.bubble,
        rule.action.bubbleDurationMs ?? 6000,
      );
    }

    return rule.id;
  }
}
