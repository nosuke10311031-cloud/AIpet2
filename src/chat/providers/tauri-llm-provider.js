import { invoke } from "@tauri-apps/api/core";

export class TauriLlmProvider {
  constructor({ id, label }) {
    this.id = id;
    this.label = label;
  }

  async complete(messages) {
    return invoke("complete_chat", {
      provider: this.id,
      messages,
    });
  }
}
