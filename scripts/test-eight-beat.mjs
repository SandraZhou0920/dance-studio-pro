import {
  splitEightBeatPhrases,
  buildEightBeatPhrasesFromBpm,
  reflowEightBeatsFromAnchor,
  reflowFromWaveformSelection,
} from '../src/features/eightbeat/beatAnalyzer.js';
import { downbeatsInPhrase, findCrossedDownbeat } from '../src/features/eightbeat/downbeats.js';
import { addActionHit, hitsInTimeRange } from '../src/features/actionhits/actionHits.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const r = splitEightBeatPhrases({ duration: 64, bpm: 120, offset: 0 });
assert(r.phraseSec === 4, `phraseSec ${r.phraseSec}`);
assert(r.phrases.length === 16, `count ${r.phrases.length}`);
assert(r.phrases[0].start === 0 && r.phrases[0].end === 4, 'first phrase');
assert(r.phrases[15].end === 64, 'last phrase end');

const r2 = splitEightBeatPhrases({ duration: 20, bpm: 100, offset: 0.4 });
assert(r2.phrases[0].start === 0.4, 'offset');
assert(r2.phrases[0].end === 5.2, 'first 100bpm phrase');
assert(r2.phrases.length === 4, `leftover skip ${r2.phrases.length}`);

const built = buildEightBeatPhrasesFromBpm(32, 120, (n) => `八拍 ${n}`);
assert(built.eightBeatPhrases.length === 8, `count ${built.eightBeatPhrases.length}`);
assert(built.eightBeatPhrases[0].name === '八拍 1', 'name');
assert(built.eightBeatPhrases[0].id.startsWith('eb-'), 'id prefix');
assert(built.eightBeatPhrases[0].end === 4, '8 beats at 120bpm is 4s');

let threw = false;
try {
  splitEightBeatPhrases({ duration: 0, bpm: 120 });
} catch {
  threw = true;
}
assert(threw, 'invalid duration');

const reflow = reflowEightBeatsFromAnchor({
  videoDuration: 64,
  anchorIndex: 2,
  start: 8.5,
  end: 13,
  nameFn: (n) => `八拍 ${n}`,
});
const lens = reflow.eightBeatPhrases.map((p) => Number((p.end - p.start).toFixed(2)));
assert(lens.every((d) => d === lens[0]), `unequal ${lens.join(',')}`);
assert(lens[0] === 4.5, `dur ${lens[0]}`);
const anchored = reflow.eightBeatPhrases[reflow.selectedIndex];
assert(Math.abs(anchored.start - 8.5) < 0.06, `anchor start ${anchored.start}`);

const beats = downbeatsInPhrase({ start: 0, end: 4 });
assert(beats.length === 8, `beats ${beats.length}`);
assert(beats[0].time === 0 && beats[0].beat === 1, 'beat 1');
assert(beats[7].time === 3.5, `beat 8 ${beats[7].time}`);

const marks = [
  { time: 4, key: 'a-1', beat: 1 },
  { time: 4.5, key: 'a-2', beat: 2 },
];
assert(findCrossedDownbeat(3.98, 4.02, marks, null)?.key === 'a-1', 'cross beat 1');
assert(findCrossedDownbeat(4.0, 4.02, marks, 'a-1')?.key !== 'a-1', 'skip held beat');
assert(findCrossedDownbeat(4.48, 4.51, marks, '')?.key === 'a-2', 'cross beat 2');
assert(findCrossedDownbeat(10, 4, marks, null) == null, 'no fire on seek back');
assert(findCrossedDownbeat(0, 5, marks, null)?.key === 'a-1', 'forward jump still holds first mark');

const dragged = reflowFromWaveformSelection({
  videoDuration: 64,
  start: 8,
  end: 12,
  nameFn: (n) => `八拍 ${n}`,
});
assert(dragged.eightBeatPhrases.every((p) => Number((p.end - p.start).toFixed(2)) === 4), 'drag equal');
const stay = dragged.eightBeatPhrases[dragged.selectedIndex];
assert(Math.abs(stay.start - 8) < 0.06, `drag stay ${stay.start}`);

const hits = addActionHit([], 1.25, (n) => `动作 ${n}`);
assert(hits.length === 1 && hits[0].time === 1.25, 'action hit');
assert(addActionHit(hits, 1.26, (n) => `动作 ${n}`).length === 1, 'dedupe');
assert(addActionHit(hits, 2, (n) => `动作 ${n}`).length === 2, 'second hit');
assert(hits[0].pauseOnHit === true, 'pause by default');
const ranged = hitsInTimeRange(
  [
    { id: 'a', time: 1 },
    { id: 'b', time: 2 },
    { id: 'c', time: 5 },
  ],
  0.5,
  2.2
);
assert(ranged.map((h) => h.id).join(',') === 'a,b', 'range select');

console.log('splitEightBeatPhrases ok');
