import { guess } from 'web-audio-beat-detector';
import { decodeOriginalAudioBuffer } from '../../utils/originalAudio.js';

export { downbeatsInPhrase, downbeatsForPhrases } from './downbeats.js';

const TEMPO_SETTINGS = { minTempo: 60, maxTempo: 200 };

/**
 * 按固定窗口时长与偏移，把原片切成连续等长乐句（不足 0.4s 的尾巴丢掉）。
 */
export function splitEqualPhrases({ duration, phraseSec, offset = 0 }) {
  const total = Number(duration);
  const phrase = Number(phraseSec);
  if (!Number.isFinite(total) || total <= 0.4) {
    throw new Error('duration-invalid');
  }
  if (!Number.isFinite(phrase) || phrase < 0.4) {
    throw new Error('phrase-invalid');
  }

  let cursor = Number(offset) || 0;
  while (cursor < 0) cursor += phrase;
  if (cursor >= total) cursor = 0;

  const phrases = [];
  let index = 1;
  while (cursor < total - 0.35) {
    const end = Math.min(total, cursor + phrase);
    if (end - cursor >= 0.4 && Math.abs(end - cursor - phrase) < 0.05) {
      phrases.push({
        index,
        start: Number(cursor.toFixed(2)),
        end: Number(end.toFixed(2)),
      });
      index += 1;
    } else if (end - cursor >= 0.4 && cursor + phrase > total) {
      break;
    }
    cursor += phrase;
  }

  if (phrases.length === 0) {
    throw new Error('no-phrases');
  }
  return { phraseSec: Number(phrase.toFixed(3)), phrases };
}

/**
 * 按 BPM 与第一拍偏移，把整段时长切成连续的 8 拍窗口。
 */
export function splitEightBeatPhrases({ duration, bpm, offset = 0, beatsPerPhrase = 8 }) {
  const tempo = Number(bpm);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error('bpm-invalid');
  }
  const phrase = (60 / tempo) * beatsPerPhrase;
  return splitEqualPhrases({ duration, phraseSec: phrase, offset });
}

/**
 * 以某一段的新起止为锚：所有八拍等长，前后按同一窗口铺满原片。
 */
export function reflowEightBeatsFromAnchor({
  videoDuration,
  anchorIndex,
  start,
  end,
  nameFn,
  beatsPerPhrase = 8,
}) {
  let s = Number(start);
  let e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) {
    throw new Error('range-invalid');
  }
  if (e < s) {
    const tmp = s;
    s = e;
    e = tmp;
  }
  const phraseSec = e - s;
  if (phraseSec < 0.4) {
    throw new Error('phrase-invalid');
  }
  const k = Math.max(0, Math.floor(Number(anchorIndex) || 0));
  const offset = s - k * phraseSec;
  const { phrases } = splitEqualPhrases({
    duration: videoDuration,
    phraseSec,
    offset,
  });
  const bpm = (beatsPerPhrase * 60) / phraseSec;
  let selectedIndex = phrases.findIndex((p) => Math.abs(p.start - Number(s.toFixed(2))) < 0.06);
  if (selectedIndex < 0) selectedIndex = Math.min(k, phrases.length - 1);

  return {
    eightBeatPhrases: phrasesToEightBeats(phrases, nameFn),
    bpm: Number(bpm.toFixed(2)),
    offset: Number(Math.max(0, offset).toFixed(2)),
    phraseSec: Number(phraseSec.toFixed(3)),
    selectedIndex,
  };
}

/** 波形上框选一个八拍：以其时长铺满原片。 */
export function reflowFromWaveformSelection({ videoDuration, start, end, nameFn }) {
  let s = Number(start);
  let e = Number(end);
  if (e < s) {
    const tmp = s;
    s = e;
    e = tmp;
  }
  const phraseSec = e - s;
  const k = Math.max(0, Math.round(s / phraseSec));
  return reflowEightBeatsFromAnchor({
    videoDuration,
    anchorIndex: k,
    start: s,
    end: e,
    nameFn,
  });
}

export function phrasesToEightBeats(phrases, nameFn) {
  const stamp = Date.now();
  return phrases.map((p) => ({
    id: `eb-${stamp}-${p.index}`,
    name: nameFn(p.index),
    start: p.start,
    end: p.end,
    pauseOnDownbeats: Boolean(p.pauseOnDownbeats),
  }));
}

export function eightBeatsToLoopSegments(eightBeatPhrases) {
  const stamp = Date.now();
  return (eightBeatPhrases || []).map((p, i) => ({
    id: `seg-from-eb-${stamp}-${i + 1}`,
    name: p.name,
    start: p.start,
    end: p.end,
    targetLoops: 3,
    playbackRate: 0.8,
  }));
}

export function buildEightBeatPhrasesFromBpm(videoDuration, bpm, nameFn, offset = 0) {
  const { phrases, phraseSec } = splitEightBeatPhrases({
    duration: videoDuration,
    bpm,
    offset,
  });
  return {
    eightBeatPhrases: phrasesToEightBeats(phrases, nameFn),
    bpm,
    offset,
    phraseSec,
  };
}

async function decodeMediaFile(file) {
  return decodeOriginalAudioBuffer(file);
}

async function detectTempo(audioBuffer) {
  const dur = audioBuffer.duration || 0;
  const windows = [
    [Math.min(8, Math.max(0, dur * 0.08)), Math.min(40, Math.max(8, dur * 0.5))],
    [0, Math.min(24, dur)],
    [Math.max(0, dur * 0.3), Math.min(30, dur * 0.4)],
  ];
  let lastErr = new Error('tempo-failed');
  for (const [start, span] of windows) {
    if (!Number.isFinite(span) || span < 4) continue;
    try {
      const guessed = await guess(audioBuffer, start, span, TEMPO_SETTINGS);
      const bpm = guessed?.bpm || guessed?.tempo;
      if (Number.isFinite(bpm) && bpm >= 50 && bpm <= 220) return guessed;
    } catch (err) {
      lastErr = err;
    }
  }
  try {
    const guessed = await guess(audioBuffer, TEMPO_SETTINGS);
    const bpm = guessed?.bpm || guessed?.tempo;
    if (Number.isFinite(bpm) && bpm >= 50 && bpm <= 220) return guessed;
    lastErr = new Error('tempo-failed');
  } catch (err) {
    lastErr = err;
  }
  throw lastErr;
}

export async function detectAndBuildEightBeats(file, videoDuration, nameFn) {
  let audioBuffer;
  try {
    audioBuffer = await decodeMediaFile(file);
  } catch (err) {
    const fail = new Error('decode-failed');
    fail.code = 'decode-failed';
    fail.cause = err;
    throw fail;
  }
  let guessed;
  try {
    guessed = await detectTempo(audioBuffer);
  } catch (err) {
    const fail = new Error('tempo-failed');
    fail.code = 'tempo-failed';
    fail.cause = err;
    throw fail;
  }
  const bpm = guessed.bpm || Math.round(guessed.tempo);
  const offset = Number.isFinite(guessed.offset) ? guessed.offset : 0;
  const duration =
    Number.isFinite(videoDuration) && videoDuration > 0
      ? videoDuration
      : audioBuffer.duration;

  return buildEightBeatPhrasesFromBpm(duration, bpm, nameFn, offset);
}
