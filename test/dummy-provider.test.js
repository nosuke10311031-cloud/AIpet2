import assert from "node:assert/strict";
import test from "node:test";
import { DummyProvider } from "../src/chat/providers/dummy-provider.js";
import { ProviderRegistry } from "../src/chat/provider-registry.js";

test("dummy provider returns a local response", async () => {
  const provider = new DummyProvider();
  const reply = await provider.complete([{ role: "user", content: "こんにちは" }]);

  assert.equal(reply.provider, "dummy");
  assert.equal(reply.model, "local-rules");
  assert.match(reply.content, /Mochi|こんにちは/);
});

test("registry falls back to dummy for unknown providers", () => {
  const registry = new ProviderRegistry();
  assert.equal(registry.get("unknown").id, "dummy");
  assert.deepEqual(
    registry.list().map(({ id }) => id),
    ["dummy", "openai", "ollama"],
  );
});
