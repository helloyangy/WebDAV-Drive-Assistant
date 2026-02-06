import { getMeta, listMeta, setMeta } from "./cache.js";

export class SyncEngine {
  constructor(client, options) {
    this.client = client;
    this.options = {
      concurrency: 2,
      ...options
    };
    this.queue = [];
    this.running = 0;
    this.runScheduled = false;
    this.listeners = {
      progress: [],
      conflict: [],
      error: []
    };
  }

  onProgress(callback) {
    this.listeners.progress.push(callback);
  }

  onConflict(callback) {
    this.listeners.conflict.push(callback);
  }

  onError(callback) {
    this.listeners.error.push(callback);
  }

  emit(type, payload) {
    for (const callback of this.listeners[type]) {
      callback(payload);
    }
  }

  enqueue(task) {
    this.queue.push(task);
    this.scheduleRun();
  }

  scheduleRun() {
    if (this.runScheduled) {
      return;
    }
    this.runScheduled = true;
    queueMicrotask(() => {
      this.runScheduled = false;
      this.run();
    });
  }

  run() {
    while (this.running < this.options.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this.running += 1;
      this.executeTask(task)
        .catch((error) => {
          this.emit("error", error);
        })
        .finally(() => {
          this.running -= 1;
          this.scheduleRun();
        });
    }
  }

  async executeTask(task) {
    if (task.type === "list") {
      const items = await this.client.list(task.path);
      await setMeta({ path: task.path, items, updatedAt: Date.now() });
      this.emit("progress", { type: "list", path: task.path, count: items.length });
      return;
    }
    if (task.type === "refresh") {
      const cached = await listMeta();
      for (const entry of cached) {
        this.enqueue({ type: "list", path: entry.path });
      }
      return;
    }
  }

  async diff(path) {
    const cached = await getMeta(path);
    const live = await this.client.list(path);
    const cachedNames = new Set((cached?.items || []).map((item) => item.name));
    const added = live.filter((item) => !cachedNames.has(item.name));
    return { added, live };
  }
}
