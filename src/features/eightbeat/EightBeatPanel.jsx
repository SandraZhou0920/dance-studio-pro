import { useState } from 'react';
import {
  detectAndBuildEightBeats,
  buildEightBeatPhrasesFromBpm,
  eightBeatsToLoopSegments,
} from './beatAnalyzer';

export default function EightBeatPanel({
  t,
  currentVideo,
  videoRef,
  activeEightBeatIndex,
  setActiveEightBeatIndex,
  eightBeatPickIds,
  setEightBeatPickIds,
  updateCurrentVideoConfig,
  triggerFramePreview,
  reflowEightBeatAt,
}) {
  const phrases = currentVideo.eightBeatPhrases ?? [];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [draftTimes, setDraftTimes] = useState({});
  const [bpmInput, setBpmInput] = useState(
    currentVideo.detectedBpm ? String(Math.round(currentVideo.detectedBpm)) : '120'
  );

  const persistPhrases = async (result) => {
    setActiveEightBeatIndex(0);
    const firstId = result.eightBeatPhrases[0]?.id;
    setEightBeatPickIds(firstId ? [firstId] : []);
    await updateCurrentVideoConfig(() => ({
      eightBeatPhrases: result.eightBeatPhrases,
      detectedBpm: result.bpm,
      eightBeatOffset: result.offset ?? 0,
      selectedEightBeatIndex: 0,
    }));
    setBpmInput(String(Math.round(result.bpm)));
    setMsg(t.autoEightBeatDone(result.eightBeatPhrases.length, Math.round(result.bpm)));
  };

  const splitByBpm = async () => {
    const duration = videoRef.current?.duration || 0;
    const bpm = Number(bpmInput);
    const result = buildEightBeatPhrasesFromBpm(duration, bpm, t.eightBeatSegName);
    await persistPhrases(result);
  };

  const autoDetect = async () => {
    if (busy || !currentVideo?.file) return;
    if (phrases.length > 0 && !window.confirm(t.autoEightBeatConfirm)) return;

    setBusy(true);
    setMsg(t.autoEightBeatWorking);
    try {
      const duration = videoRef.current?.duration || 0;
      const result = await detectAndBuildEightBeats(
        currentVideo.file,
        duration,
        t.eightBeatSegName
      );
      await persistPhrases(result);
    } catch (err) {
      const typed = window.prompt(t.autoEightBeatAskBpm, bpmInput);
      const bpm = Number(typed);
      if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 220) {
        try {
          const duration = videoRef.current?.duration || 0;
          const result = buildEightBeatPhrasesFromBpm(duration, bpm, t.eightBeatSegName);
          await persistPhrases(result);
          return;
        } catch {
          /* fall through */
        }
      }
      setMsg(err?.code === 'decode-failed' ? t.autoEightBeatFailDecode : t.autoEightBeatFail);
    } finally {
      setBusy(false);
    }
  };

  const applyToLoop = async () => {
    if (phrases.length === 0) return;
    if (currentVideo.segments.length > 0 && !window.confirm(t.eightBeatApplyLoopConfirm)) return;
    const segments = eightBeatsToLoopSegments(phrases);
    await updateCurrentVideoConfig(() => ({
      segments,
      selectedSegmentIndex: 0,
    }));
    setMsg(t.eightBeatApplyLoopDone(segments.length));
  };

  const clearPhrases = async () => {
    if (phrases.length === 0) return;
    if (!window.confirm(t.eightBeatClearConfirm)) return;
    setActiveEightBeatIndex(0);
    setEightBeatPickIds([]);
    await updateCurrentVideoConfig(() => ({
      eightBeatPhrases: [],
      selectedEightBeatIndex: 0,
    }));
    setMsg(null);
  };

  const picked = new Set(
    eightBeatPickIds?.length ? eightBeatPickIds : phrases[activeEightBeatIndex]?.id
      ? [phrases[activeEightBeatIndex].id]
      : []
  );

  const togglePauseOnPicked = () => {
    if (picked.size === 0) return;
    const enable = phrases.some((p) => picked.has(p.id) && !p.pauseOnDownbeats);
    updateCurrentVideoConfig((v) => ({
      eightBeatPhrases: (v.eightBeatPhrases || []).map((p) =>
        picked.has(p.id) ? { ...p, pauseOnDownbeats: enable } : p
      ),
    }));
    setMsg(enable ? t.eightBeatPauseOnDone(picked.size) : t.eightBeatPauseOffDone);
  };

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-amber-900/50 space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-200">{t.eightBeatPanelTitle}</h2>
          <p className="text-[11px] text-gray-400 mt-1 max-w-xl">{t.eightBeatPanelHint}</p>
        </div>
        {currentVideo.detectedBpm ? (
          <span className="text-xs font-mono text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-1 rounded">
            ~{Math.round(currentVideo.detectedBpm)} BPM
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={autoDetect}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {busy ? t.autoEightBeatWorking : t.autoEightBeatBtn}
        </button>
        <label className="text-xs text-gray-400">
          BPM
          <input
            type="number"
            min="40"
            max="220"
            step="1"
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            className="mt-1 block w-24 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm font-mono text-white"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={splitByBpm}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {t.eightBeatSplitByBpm}
        </button>
        <button
          type="button"
          disabled={phrases.length === 0}
          onClick={applyToLoop}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {t.eightBeatApplyLoop}
        </button>
        <button
          type="button"
          disabled={picked.size === 0}
          onClick={togglePauseOnPicked}
          className="bg-rose-800 hover:bg-rose-700 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {phrases.some((p) => picked.has(p.id) && p.pauseOnDownbeats)
            ? t.eightBeatPauseOff
            : t.eightBeatPauseOn}
        </button>
        <button
          type="button"
          disabled={phrases.length === 0}
          onClick={clearPhrases}
          className="text-gray-400 hover:text-red-400 disabled:opacity-40 px-3 py-1.5 text-xs cursor-pointer"
        >
          {t.eightBeatClear}
        </button>
      </div>

      {msg && <p className="text-[11px] text-amber-300/90">{msg}</p>}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {phrases.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
            {t.emptyEightBeats}
          </div>
        ) : (
          phrases.map((p, index) => {
            const isPicked = picked.has(p.id);
            return (
              <div
                key={p.id}
                className={`w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  isPicked
                    ? 'bg-amber-950/70 border-amber-500 text-amber-100'
                    : 'bg-gray-950 border-gray-800 text-gray-300'
                } ${p.pauseOnDownbeats ? 'ring-1 ring-rose-500/70' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isPicked}
                  onChange={() => {
                    setEightBeatPickIds((ids) => {
                      const cur = ids?.length ? ids : [];
                      return cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id];
                    });
                    setActiveEightBeatIndex(index);
                    updateCurrentVideoConfig(() => ({ selectedEightBeatIndex: index }));
                  }}
                  className="accent-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    setActiveEightBeatIndex(index);
                    updateCurrentVideoConfig(() => ({ selectedEightBeatIndex: index }));
                    triggerFramePreview(p.start, p.name);
                    if (e.shiftKey) {
                      const from = Math.min(activeEightBeatIndex, index);
                      const to = Math.max(activeEightBeatIndex, index);
                      setEightBeatPickIds(phrases.slice(from, to + 1).map((item) => item.id));
                    } else if (e.metaKey || e.ctrlKey) {
                      setEightBeatPickIds((ids) => {
                        const cur = ids?.length ? ids : [];
                        return cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id];
                      });
                    } else {
                      setEightBeatPickIds([p.id]);
                    }
                  }}
                  className="flex items-center gap-2 text-left cursor-pointer min-w-0"
                >
                  <span className="font-mono text-amber-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{p.name}</span>
                  {p.pauseOnDownbeats ? (
                    <span className="text-[10px] text-rose-300">{t.eightBeatPauseMark}</span>
                  ) : null}
                </button>
                <div
                  className="ml-auto flex items-center gap-1.5 font-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draftTimes[p.id]?.start ?? p.start}
                    onFocus={() => {
                      setActiveEightBeatIndex(index);
                      updateCurrentVideoConfig(() => ({ selectedEightBeatIndex: index }));
                    }}
                    onChange={(e) =>
                      setDraftTimes((prev) => ({
                        ...prev,
                        [p.id]: { start: e.target.value, end: prev[p.id]?.end ?? p.end },
                      }))
                    }
                    onBlur={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setDraftTimes((prev) => {
                        const next = { ...prev };
                        delete next[p.id];
                        return next;
                      });
                      reflowEightBeatAt(p.id, val, p.end);
                      triggerFramePreview(val, `${p.name} ${t.startLabel}`);
                    }}
                    className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-amber-200 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={draftTimes[p.id]?.end ?? p.end}
                    onFocus={() => {
                      setActiveEightBeatIndex(index);
                      updateCurrentVideoConfig(() => ({ selectedEightBeatIndex: index }));
                    }}
                    onChange={(e) =>
                      setDraftTimes((prev) => ({
                        ...prev,
                        [p.id]: { start: prev[p.id]?.start ?? p.start, end: e.target.value },
                      }))
                    }
                    onBlur={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setDraftTimes((prev) => {
                        const next = { ...prev };
                        delete next[p.id];
                        return next;
                      });
                      reflowEightBeatAt(p.id, p.start, val);
                      triggerFramePreview(val, `${p.name} ${t.endLabel}`);
                    }}
                    className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-amber-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
