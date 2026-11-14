import { splitEightBeatPhrases } from '../src/utils/beatAnalyzer.js';

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

let threw = false;
try {
  splitEightBeatPhrases({ duration: 0, bpm: 120 });
} catch {
  threw = true;
}
assert(threw, 'invalid duration');

console.log('splitEightBeatPhrases ok');
