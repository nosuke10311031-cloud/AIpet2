import { DummyProvider } from "./providers/dummy-provider.js";
import { TauriLlmProvider } from "./providers/tauri-llm-provider.js";

export class ProviderRegistry {
  constructor() {
    this.providers = new Map([
      ["dummy", new DummyProvider()],
      ["openai", new TauriLlmProvider({ id: "openai", label: "OpenAI" })],
      ["ollama", new TauriLlmProvider({ id: "ollama", label: "Ollama" })],
    ]);
  }

  get(providerId) {
    return this.providers.get(providerId) ?? this.providers.get("dummy");
  }

  list() {
    return [...this.providers.values()].map(({ id, label }) => ({ id, label }));
  }
}
