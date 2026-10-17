export type AudioState = "idle" | "preparing" | "playing" | "paused";
/** AudioBufferSource schedules segment boundaries on the audio clock, not JS timers. */
export class SegmentPlayer {
  context: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  private buffer: AudioBuffer | null = null;
  private start = 0;
  private duration = 0;
  private consumed = 0;
  private scheduled = 0;
  state: AudioState = "idle";
  onState: (s: AudioState) => void = () => {};
  constructor() {
    this.context = new AudioContext();
  }
  private set(s: AudioState) {
    this.state = s;
    this.onState(s);
  }
  stop() {
    this.generation++;
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.set("idle");
  }
  async play(blob: Blob, start: number, duration: number | null) {
    this.stop();
    const ticket = this.generation;
    this.set("preparing");
    try {
      await this.context.resume();
      const requested = this.context.currentTime;
      const buffer = await this.context.decodeAudioData(
        await blob.arrayBuffer(),
      );
      if (ticket !== this.generation) return;
      if (start < 0 || start >= buffer.duration)
        throw Error("대표 구간이 음원 길이를 벗어납니다.");
      if (duration !== null && start + duration > buffer.duration + 0.02)
        throw Error("요청한 구간보다 음원이 짧습니다.");
      this.buffer = buffer;
      this.start = start;
      this.duration = duration ?? buffer.duration - start;
      this.consumed = 0;
      this.schedule(Math.max(this.context.currentTime, requested + 0.8));
    } catch (e) {
      if (ticket === this.generation) {
        this.stop();
        throw e;
      }
    }
  }
  private schedule(when: number) {
    if (!this.buffer) return;
    const s = this.context.createBufferSource();
    s.buffer = this.buffer;
    s.connect(this.context.destination);
    this.source = s;
    this.scheduled = when;
    this.set("preparing");
    s.onended = () => {
      if (this.source === s) {
        s.disconnect();
        this.source = null;
        this.set("idle");
      }
    };
    s.start(when, this.start + this.consumed, this.duration - this.consumed);
  }
  tick() {
    if (
      this.state === "preparing" &&
      this.source &&
      this.context.currentTime >= this.scheduled
    )
      this.set("playing");
    return this.state === "playing"
      ? Math.min(
          1,
          (this.consumed +
            Math.max(0, this.context.currentTime - this.scheduled)) /
            this.duration,
        )
      : this.state === "paused"
        ? this.consumed / this.duration
        : 0;
  }
  async toggle() {
    if (this.state === "playing" || this.state === "preparing") {
      // A pending decode is canceled, while a scheduled source preserves its segment.
      if (!this.source) {
        this.stop();
        return;
      }
      this.consumed += Math.max(0, this.context.currentTime - this.scheduled);
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
      this.set("paused");
    } else if (this.state === "paused") {
      const ticket = this.generation;
      await this.context.resume();
      if (ticket !== this.generation || this.state !== "paused") return;
      if (this.consumed >= this.duration) {
        this.stop();
        return;
      }
      this.schedule(this.context.currentTime + 0.8);
    }
  }
}
