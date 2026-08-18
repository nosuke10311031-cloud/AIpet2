import Matter from "matter-js";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PET_STATES } from "./state-machine.js";

const { Bodies, Body, Composite, Engine } = Matter;
const BOUNDARY_THICKNESS = 240;

export class PetPhysicsController {
  constructor({ onDirectionChange = () => {} } = {}) {
    this.appWindow = getCurrentWindow();
    this.onDirectionChange = onDirectionChange;
    this.engine = null;
    this.petBody = null;
    this.windowSize = null;
    this.workArea = null;
    this.scaleFactor = 1;
    this.state = PET_STATES.IDLE;
    this.direction = -1;
    this.dragging = false;
    this.running = false;
    this.animationFrame = null;
    this.lastFrameAt = null;
    this.lastWindowWriteAt = 0;
    this.positionWritePending = false;
    this.queuedPosition = null;
  }

  async start() {
    const [monitor, windowPosition, windowSize] = await Promise.all([
      currentMonitor(),
      this.appWindow.outerPosition(),
      this.appWindow.outerSize(),
    ]);

    if (!monitor) throw new Error("No monitor is available for pet physics");

    this.windowSize = windowSize;
    this.workArea = monitor.workArea;
    this.scaleFactor = monitor.scaleFactor;
    this.engine = Engine.create({ enableSleeping: false });
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.0018;

    const centerX = windowPosition.x + windowSize.width / 2;
    const centerY = windowPosition.y + windowSize.height / 2;
    this.petBody = Bodies.rectangle(
      centerX,
      centerY,
      windowSize.width,
      windowSize.height,
      {
        friction: 0.75,
        frictionAir: 0.025,
        frictionStatic: 0.9,
        restitution: 0.08,
        chamfer: { radius: 8 * this.scaleFactor },
      },
    );
    Body.setInertia(this.petBody, Infinity);

    Composite.add(this.engine.world, [
      this.petBody,
      ...this.createBoundaries(this.workArea),
    ]);

    this.running = true;
    this.animationFrame = requestAnimationFrame((time) => this.tick(time));
  }

  stop() {
    this.running = false;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    if (this.engine) Engine.clear(this.engine);
  }

  setState(state) {
    this.state = state;
    if (!this.petBody || this.dragging) return;

    if (state !== PET_STATES.WALK) {
      Body.setVelocity(this.petBody, {
        x: state === PET_STATES.IDLE ? this.petBody.velocity.x * 0.25 : 0,
        y: this.petBody.velocity.y,
      });
    }
  }

  jump() {
    if (!this.petBody || this.dragging || !this.isGrounded()) return false;
    Body.setVelocity(this.petBody, {
      x: this.petBody.velocity.x,
      y: -8.5 * this.scaleFactor,
    });
    return true;
  }

  beginDrag() {
    if (!this.petBody || this.dragging) return;
    this.dragging = true;
    Body.setStatic(this.petBody, true);
  }

  async releaseFromDrag() {
    if (!this.petBody) return;

    const position = await this.appWindow.outerPosition();
    Body.setStatic(this.petBody, false);
    Body.setPosition(this.petBody, {
      x: position.x + this.windowSize.width / 2,
      y: position.y + this.windowSize.height / 2,
    });
    Body.setVelocity(this.petBody, { x: 0, y: 0 });
    Body.setInertia(this.petBody, Infinity);
    this.dragging = false;
  }

  tick(time) {
    if (!this.running) return;

    const elapsed = this.lastFrameAt === null ? 16.67 : time - this.lastFrameAt;
    this.lastFrameAt = time;

    if (!this.dragging) {
      Engine.update(this.engine, Math.min(elapsed, 33.33));
      this.updateWalkingVelocity();

      if (time - this.lastWindowWriteAt >= 32) {
        this.queueWindowPosition();
        this.lastWindowWriteAt = time;
      }
    }

    this.animationFrame = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  updateWalkingVelocity() {
    if (this.state !== PET_STATES.WALK || !this.petBody) return;

    const halfWidth = this.windowSize.width / 2;
    const minX = this.workArea.position.x + halfWidth;
    const maxX =
      this.workArea.position.x + this.workArea.size.width - halfWidth;

    if (this.petBody.position.x <= minX + 3) this.setDirection(1);
    if (this.petBody.position.x >= maxX - 3) this.setDirection(-1);

    const walkSpeed = 2.1 * this.scaleFactor;
    Body.setVelocity(this.petBody, {
      x: walkSpeed * this.direction,
      y: this.petBody.velocity.y,
    });
  }

  setDirection(direction) {
    if (direction === this.direction) return;
    this.direction = direction;
    this.onDirectionChange(direction < 0 ? "left" : "right");
  }

  isGrounded() {
    if (!this.petBody || !this.workArea) return false;
    const floorY = this.workArea.position.y + this.workArea.size.height;
    return (
      this.petBody.bounds.max.y >= floorY - 4 * this.scaleFactor &&
      Math.abs(this.petBody.velocity.y) < 1.2 * this.scaleFactor
    );
  }

  queueWindowPosition() {
    this.queuedPosition = new PhysicalPosition(
      Math.round(this.petBody.position.x - this.windowSize.width / 2),
      Math.round(this.petBody.position.y - this.windowSize.height / 2),
    );
    if (!this.positionWritePending) void this.flushWindowPosition();
  }

  async flushWindowPosition() {
    this.positionWritePending = true;

    while (this.queuedPosition && this.running && !this.dragging) {
      const nextPosition = this.queuedPosition;
      this.queuedPosition = null;
      try {
        await this.appWindow.setPosition(nextPosition);
      } catch (error) {
        console.error("Could not update the pet window position", error);
        break;
      }
    }

    this.positionWritePending = false;
  }

  createBoundaries(workArea) {
    const left = workArea.position.x;
    const top = workArea.position.y;
    const right = left + workArea.size.width;
    const bottom = top + workArea.size.height;
    const halfBoundary = BOUNDARY_THICKNESS / 2;
    const options = { isStatic: true, friction: 0.9, restitution: 0.05 };

    return [
      Bodies.rectangle(
        left + workArea.size.width / 2,
        bottom + halfBoundary,
        workArea.size.width + BOUNDARY_THICKNESS * 2,
        BOUNDARY_THICKNESS,
        options,
      ),
      Bodies.rectangle(
        left - halfBoundary,
        top + workArea.size.height / 2,
        BOUNDARY_THICKNESS,
        workArea.size.height + BOUNDARY_THICKNESS * 2,
        options,
      ),
      Bodies.rectangle(
        right + halfBoundary,
        top + workArea.size.height / 2,
        BOUNDARY_THICKNESS,
        workArea.size.height + BOUNDARY_THICKNESS * 2,
        options,
      ),
    ];
  }
}
