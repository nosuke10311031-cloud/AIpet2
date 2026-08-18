import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ProviderRegistry } from "./provider-registry.js";

const MAX_HISTORY_MESSAGES = 12;

function chatMarkup() {
  return `
    <main class="chat-panel" aria-label="Mochiとの会話">
      <header class="chat-header" data-tauri-drag-region>
        <div class="chat-header__identity" data-tauri-drag-region>
          <span class="chat-header__avatar" aria-hidden="true">🐶</span>
          <span data-tauri-drag-region>
            <strong>Mochi</strong>
            <small id="chat-provider-status">Dummy Provider</small>
          </span>
        </div>
        <button class="chat-close" id="chat-close" type="button" aria-label="会話を閉じる">×</button>
      </header>

      <section class="chat-history" id="chat-history" aria-live="polite"></section>

      <form class="chat-composer" id="chat-form">
        <label class="sr-only" for="chat-input">Mochiへのメッセージ</label>
        <textarea
          id="chat-input"
          rows="2"
          maxlength="1200"
          placeholder="Mochiに話しかける…"
          required
        ></textarea>
        <div class="chat-composer__actions">
          <label class="provider-picker">
            <span class="sr-only">LLM Provider</span>
            <select id="provider-select" aria-label="LLM Provider"></select>
          </label>
          <button class="chat-send" id="chat-send" type="submit">送信</button>
        </div>
      </form>
    </main>
  `;
}

export async function startChatView() {
  const isTauri = "__TAURI_INTERNALS__" in window;
  document.body.classList.add("chat-view");
  document.body.innerHTML = chatMarkup();

  const registry = new ProviderRegistry();
  const history = [];
  const historyElement = document.querySelector("#chat-history");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const sendButton = document.querySelector("#chat-send");
  const providerSelect = document.querySelector("#provider-select");
  const providerStatus = document.querySelector("#chat-provider-status");
  const closeButton = document.querySelector("#chat-close");

  for (const provider of registry.list()) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.label;
    providerSelect.append(option);
  }

  const savedProvider = localStorage.getItem("ai-pet:provider") ?? "dummy";
  providerSelect.value = registry.get(savedProvider).id;

  function updateProviderStatus() {
    const provider = registry.get(providerSelect.value);
    providerStatus.textContent = `${provider.label} Provider`;
  }

  function appendMessage({ role, content, isError = false }) {
    const message = document.createElement("p");
    message.className = `chat-message chat-message--${role}`;
    if (isError) message.classList.add("chat-message--error");
    message.textContent = content;
    historyElement.append(message);
    historyElement.scrollTop = historyElement.scrollHeight;
    return message;
  }

  function setBusy(busy) {
    input.disabled = busy;
    sendButton.disabled = busy;
    providerSelect.disabled = busy;
    sendButton.textContent = busy ? "考え中…" : "送信";
  }

  async function hideChat() {
    if (!isTauri) return;
    await emitTo("main", "chat:visibility", { open: false });
    await getCurrentWindow().hide();
  }

  appendMessage({
    role: "assistant",
    content: "やっほー、Mochiだよ。今日はどうしたの？",
  });
  updateProviderStatus();

  providerSelect.addEventListener("change", () => {
    localStorage.setItem("ai-pet:provider", providerSelect.value);
    updateProviderStatus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    input.value = "";
    history.push({ role: "user", content });
    appendMessage({ role: "user", content });
    setBusy(true);

    try {
      const provider = registry.get(providerSelect.value);
      const reply = await provider.complete(history.slice(-MAX_HISTORY_MESSAGES));
      history.push({ role: "assistant", content: reply.content });
      appendMessage({ role: "assistant", content: reply.content });
      providerStatus.textContent = `${provider.label} · ${reply.model}`;
      try {
        if (!isTauri) return;
        await emitTo("main", "chat:reply", { content: reply.content });
      } catch (error) {
        console.warn("Mochiの吹き出しへ応答を転送できませんでした。", error);
      }
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: typeof error === "string" ? error : "応答を受け取れませんでした。",
        isError: true,
      });
    } finally {
      setBusy(false);
      input.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  closeButton.addEventListener("click", hideChat);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") void hideChat();
  });

  const unlistenFocus = isTauri
    ? await listen("chat:focus-input", () => {
        input.focus();
        void emitTo("main", "chat:visibility", { open: true });
      })
    : () => {};

  window.addEventListener("beforeunload", () => unlistenFocus());
}
