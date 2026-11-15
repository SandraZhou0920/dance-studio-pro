const peakCache = new Map();

const cacheKey = (file) =>
  `${file?.name || 'blob'}-${file?.size || 0}-${file?.lastModified || 0}`;

function decodeAudioDataP(ctx, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buf) => {
      if (settled) return;
      settled = true;
      resolve(buf);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error('decode-failed'));
    };
    try {
      const maybe = ctx.decodeAudioData(bytes, ok, fail);
      if (maybe && typeof maybe.then === 'function') maybe.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  });
}

export async function decodeOriginalAudioBuffer(file) {
  if (!file) throw new Error('no-file');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('no-audio-context');
  const data = await file.arrayBuffer();
  const rates = [undefined, 44100, 48000];
  let lastErr = new Error('decode-failed');
  for (const rate of rates) {
    const ctx = rate ? new Ctx({ sampleRate: rate }) : new Ctx();
    try {
      return await decodeAudioDataP(ctx, data.slice(0));
    } catch (err) {
      lastErr = err;
    } finally {
      await ctx.close().catch(() => {});
    }
  }
  throw lastErr;
}

function channelPeaks(data, bars) {
  const block = Math.max(1, Math.floor(data.length / bars));
  const out = new Float32Array(bars);
  for (let i = 0; i < bars; i += 1) {
    let max = 0;
    const start = i * block;
    const end = Math.min(data.length, start + block);
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    out[i] = max;
  }
  return out;
}

export function peaksFromAudioBuffer(buffer, bars = 4000) {
  const count = Math.max(400, Math.min(bars, Math.round((buffer.duration || 1) * 90)));
  const channels = [];
  const n = Math.min(2, buffer.numberOfChannels || 1);
  for (let c = 0; c < n; c += 1) {
    channels.push(channelPeaks(buffer.getChannelData(c), count));
  }
  return channels;
}

/** 原片音轨峰值（1x、不循环）。与播放器变速/段落重复无关。 */
export async function extractOriginalAudioPeaks(file, bars = 4000) {
  const key = cacheKey(file);
  const cached = peakCache.get(key);
  if (cached) return cached;

  const buffer = await decodeOriginalAudioBuffer(file);
  const result = {
    peaks: peaksFromAudioBuffer(buffer, bars),
    duration: buffer.duration,
  };
  peakCache.set(key, result);
  return result;
}
