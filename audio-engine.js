// A shared, pre-rendered splice avoids timer scheduling and background-tab drift.
export const CROSSFADE_SECONDS = 0.06;
export function prepareLoop(context, buffer, frames, overlap, offset = 0) {
  const length = frames - overlap;
  const result = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const source = buffer.getChannelData(c).subarray(offset), out = result.getChannelData(c);
    // Rotate the seam to the start: tail -> head, then the untouched middle.
    for (let i = 0; i < overlap; i++) {
      const weight = (1 - Math.cos(Math.PI * i / (overlap - 1))) / 2;
      out[i] = source[length + i] * (1 - weight) + source[i] * weight;
    }
    out.set(source.subarray(overlap, length), overlap);
  }
  return result;
}
export class StemEngine {
  constructor() { this.context = null; this.sources = []; this.gains = []; this.ready = false; this.loading = null; }
  unlock() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio is unavailable.');
      this.context = new Audio();
    }
    return this.context.resume();
  }
  load(tracks, progress) {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.initialize(tracks, progress).finally(() => { this.loading = null; });
    return this.loading;
  }
  async initialize(tracks, progress) {
    const ctx = this.context;
    let completed = 0;
    const buffers = await Promise.all(tracks.map(async track => {
      const response = await fetch(new URL(`audio/${encodeURIComponent(track.file)}`, import.meta.url), {signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error(`Could not load ${track.file} (${response.status})`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      progress(++completed);
      return buffer;
    }));
    let frames = Math.min(...buffers.map(b => b.length));
    if (Math.max(...buffers.map(b => b.length)) - frames > ctx.sampleRate * .01) throw new Error('Stem lengths do not match.');
    // Apple MP3 metadata: 528 priming + 2,112,925 valid + 2,771 padding frames.
    // Chromium exposes the encoded length; some decoders already remove padding.
    const encodedFrames = Math.round(44.088 * ctx.sampleRate);
    const validFrames = Math.round(2112925 / 48000 * ctx.sampleRate);
    const padded = Math.abs(frames - encodedFrames) <= 2;
    const offset = padded ? Math.round(528 / 48000 * ctx.sampleRate) : 0;
    if (padded) frames = validFrames;
    else if (Math.abs(frames - validFrames) > 2) throw new Error("Unexpected decoded length; inspect MP3 padding.");
    const overlap = Math.round(ctx.sampleRate * CROSSFADE_SECONDS);
    if (frames <= overlap * 2) throw new Error('Audio is too short.');
    const loops = buffers.map(b => prepareLoop(ctx, b, frames, overlap, offset));
    // Preserve the original mix balance and calculate conservative headroom for
    // every possible selection, including combinations with less cancellation.
    let peak = 0;
    for (let c = 0; c < 2; c++) {
      const channels = loops.map(b => b.getChannelData(Math.min(c, b.numberOfChannels - 1)));
      for (let i = 0; i < loops[0].length; i++) {
        let sum = 0;
        for (const channel of channels) sum += Math.abs(channel[i]);
        peak = Math.max(peak, sum);
      }
    }
    this.master = ctx.createGain();
    this.master.gain.value = Math.min(1, .85 / (peak || 1));
    this.master.connect(ctx.destination);
    this.gains = loops.map(() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); return g; });
    this.sources = loops.map((buffer, i) => {
      const source = ctx.createBufferSource(); source.buffer = buffer;
      source.loop = true; source.loopStart = 0; source.loopEnd = buffer.duration;
      source.connect(this.gains[i]); return source;
    });
    // Build every node before choosing the single shared start timestamp.
    this.startTime = ctx.currentTime + .08;
    this.sources.forEach(source => source.start(this.startTime));
    this.loopDuration = loops[0].duration;
    this.decodedDuration = frames / ctx.sampleRate;
    this.ready = true;
  }
  setChannel(index, active) {
    if (!this.ready) return;
    const param = this.gains[index].gain, now = this.context.currentTime;
    param.setTargetAtTime(active ? 1 : 0, now, .025);
  }
  async pause() { if (this.context) await this.context.suspend(); }
}
