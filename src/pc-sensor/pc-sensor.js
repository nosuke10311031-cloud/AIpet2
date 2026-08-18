import { invoke } from "@tauri-apps/api/core";

export class PcSensor {
  constructor({
    pollIntervalMs = 2000,
    sample = () => invoke("pc_sensor_tick"),
    onContextChange = () => {},
    onSnapshot = () => {},
    dispatch = (detail) =>
      window.dispatchEvent(
        new CustomEvent("pc-sensor:context-change", { detail }),
      ),
  } = {}) {
    this.pollIntervalMs = pollIntervalMs;
    this.sample = sample;
    this.onContextChange = onContextChange;
    this.onSnapshot = onSnapshot;
    this.dispatch = dispatch;
    this.currentContext = null;
    this.timer = null;
    this.running = false;
    this.samplePending = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    void this.tick();
    this.timer = window.setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.samplePending) return this.currentContext;
    this.samplePending = true;

    try {
      const snapshot = await this.sample();
      const nextContext = snapshot?.currentContext ?? null;
      const previousBundleId = this.currentContext?.bundleId ?? null;
      const nextBundleId = nextContext?.bundleId ?? null;
      this.currentContext = nextContext;
      this.onSnapshot(snapshot);

      if (nextBundleId !== previousBundleId) {
        this.onContextChange(nextContext, snapshot);
        this.dispatch({ context: nextContext, snapshot });
      }

      return nextContext;
    } catch (error) {
      console.warn("PC Sensorの更新に失敗しました。", error);
      return this.currentContext;
    } finally {
      this.samplePending = false;
    }
  }
}
