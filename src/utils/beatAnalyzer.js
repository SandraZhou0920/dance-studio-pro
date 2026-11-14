import { guess } from 'web-audio-beat-detector';

const TEMPO_SETTINGS = { minTempo: 70, maxTempo: 185 };

/**
 * 按 BPM 与第一拍偏移，把整段时长切成连续的 8 拍窗口。
 * 纯函数，方便单测；不依赖浏览器。
 */
export function splitEightBeatPhrases({ duration, bpm, offset = 0 }) {
  const total = Number(duration);
  const tempo = Number(bpm);
  if (!Number.isFinite(total) || total <= 0.4) {
    throw new Error('duration-invalid');
  }
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error('bpm-invalid');
  }

  const phrase = (60 / tempo) * 8;
  let cursor = Math.max(0, Number(offset) || 0);
  if (cursor >= total) cursor = 0;

  const phrases = [];
  let index = 1;
  while (cursor < total - 0.35) {
    const end = Math.min(total, cursor + phrase);
    if (end - cursor >= 0.4) {
      phrases.push({
        index,
        start: Number(cursor.toFixed(2)),
        end: Number(end.toFixed(2)),
      });
      index += 1;
    }
    cursor = end;
  }

  if (phrases.length === 0) {
    throw new Error('no-phrases');
  }
  return { phraseSec: Number(phrase.toFixed(3)), phrases };
}

async function decodeMediaFile(file) {
  if (!file) throw new Error('no-file');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('no-audio-context');
  const ctx = new Ctx();
  try {
    const data = await file.arrayBuffer();
    return await ctx.decodeAudioData(data.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function detectTempo(audioBuffer) {
  const start = Math.min(8, Math.max(0, audioBuffer.duration * 0.08));
  const span = Math.min(40, Math.max(10, audioBuffer.duration - start));
  try {
    return await guess(audioBuffer, start, span, TEMPO_SETTINGS);
  } catch {
    return guess(audioBuffer, TEMPO_SETTINGS);
  }
}

/**
 * 从视频 File 解码音频、估 BPM，生成练习室循环段。
 */
export async function buildEightBeatSegments(file, videoDuration, nameFn) {
  const audioBuffer = await decodeMediaFile(file);
  const guessed = await detectTempo(audioBuffer);
  const bpm = guessed.bpm || Math.round(guessed.tempo);
  const offset = Number.isFinite(guessed.offset) ? guessed.offset : 0;
  const duration =
    Number.isFinite(videoDuration) && videoDuration > 0
      ? videoDuration
      : audioBuffer.duration;

  const { phrases, phraseSec } = splitEightBeatPhrases({ duration, bpm, offset });
  const stamp = Date.now();
  const segments = phrases.map((p) => ({
    id: `seg-8b-${stamp}-${p.index}`,
    name: nameFn(p.index),
    start: p.start,
    end: p.end,
    targetLoops: 3,
    playbackRate: 0.8,
  }));

  return { segments, bpm, offset, phraseSec };
}
