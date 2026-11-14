import { clampIndex } from '../../utils/clampIndex';

export default function LoopControlPanel({
  t,
  currentVideo,
  videoRef,
  playMode,
  highlightsMode,
  activeSegmentIndex,
  persistPlayMode,
  persistHighlightsMode,
  persistSelectedSegment,
  updateCurrentVideoConfig,
  setActiveSegmentIndex,
  moveSegment,
  triggerFramePreview,
}) {
  const isFullLoop = currentVideo.loopFullTrack ?? true;

  const addSegmentAtPlayhead = () => {
    if (!videoRef.current) return;
    const start = Number(videoRef.current.currentTime.toFixed(2));
    const end = Number(Math.min(videoRef.current.duration || start + 4, start + 4).toFixed(2));
    const newSeg = {
      id: `seg-${Date.now()}`,
      name: t.defaultSegName(currentVideo.segments.length + 1),
      start,
      end,
      targetLoops: 3,
      playbackRate: 0.75,
    };
    updateCurrentVideoConfig((v) => {
      const updated = [...v.segments, newSeg];
      const idx = updated.length - 1;
      setActiveSegmentIndex(idx);
      return { segments: updated, selectedSegmentIndex: idx };
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
          <div className="text-xs text-gray-400 font-medium">{t.playModeLabel}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => persistPlayMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                playMode === 'single'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.modeSingle}
            </button>
            <button
              onClick={() => persistPlayMode('highlights')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                playMode === 'highlights'
                  ? 'bg-rose-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.modeHighlights}
            </button>
            <button
              onClick={() => persistPlayMode('practice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                playMode === 'practice'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.modePractice}
            </button>
            <button
              onClick={() => persistPlayMode('off')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                playMode === 'off'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.modeOff}
            </button>
            <button
              onClick={() => updateCurrentVideoConfig(() => ({ loopFullTrack: !isFullLoop }))}
              className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition ${
                isFullLoop
                  ? 'bg-amber-600/90 border-amber-400 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {isFullLoop ? t.fullTrackLoopOn : t.fullTrackLoopOff}
            </button>
          </div>

          {playMode === 'highlights' && (
            <div className="flex flex-wrap items-center gap-2 bg-rose-950/30 border border-rose-800/60 px-3 py-2 rounded-lg">
              <span className="text-xs text-rose-300">{t.highlightsSubLabel}</span>
              <button
                onClick={() => persistHighlightsMode('sequential')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition ${
                  highlightsMode === 'sequential'
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.highlightsSequential}
              </button>
              <button
                onClick={() => persistHighlightsMode('merged')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition ${
                  highlightsMode === 'merged'
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.highlightsMerged}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-gray-800/70 p-3 rounded-lg border border-gray-700/80 flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-300 whitespace-nowrap">{t.globalSpeedLabel}</span>
            <input
              type="range"
              min="0.25"
              max="1.50"
              step="0.01"
              value={currentVideo.globalRate}
              onChange={(e) =>
                updateCurrentVideoConfig(() => ({ globalRate: parseFloat(e.target.value) }))
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-indigo-400 w-12 text-right">
              {currentVideo.globalRate.toFixed(2)}x
            </span>
            <button
              onClick={() => updateCurrentVideoConfig(() => ({ globalRate: 1.0 }))}
              className="text-[11px] bg-gray-700 hover:bg-gray-600 px-1.5 py-0.5 rounded text-gray-300 cursor-pointer"
            >
              1.0x
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={currentVideo.syncLoopRate}
                onChange={(e) =>
                  updateCurrentVideoConfig(() => ({ syncLoopRate: e.target.checked }))
                }
                className="accent-indigo-500"
              />
              {t.syncGlobalRateLabel}
            </label>
            <span>{t.shortcutHint}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-200">{t.segmentListTitle}</h2>
          <button
            onClick={addSegmentAtPlayhead}
            className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
          >
            {t.addSegmentBtn}
          </button>
        </div>

        <div className="space-y-2.5">
          {currentVideo.segments.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
              {t.emptySegments}
            </div>
          ) : (
            currentVideo.segments.map((seg, index) => {
              const isActive = index === activeSegmentIndex;
              const segRate = seg.playbackRate ?? 0.75;
              return (
                <div
                  key={seg.id}
                  onClick={() => {
                    persistSelectedSegment(index);
                    triggerFramePreview(seg.start, seg.name);
                  }}
                  className={`flex flex-wrap items-center justify-between p-3 rounded-lg border transition cursor-pointer gap-3 ${
                    isActive
                      ? 'bg-rose-950/30 border-rose-600'
                      : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-rose-600 text-white' : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={seg.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateCurrentVideoConfig((v) => ({
                          segments: v.segments.map((s) =>
                            s.id === seg.id ? { ...s, name: e.target.value } : s
                          ),
                        }))
                      }
                      className="bg-transparent border-b border-gray-600 focus:border-indigo-400 text-sm font-medium w-24 focus:outline-none"
                    />
                    <div
                      className="flex items-center gap-1.5 text-xs font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={seg.start}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          updateCurrentVideoConfig((v) => ({
                            segments: v.segments.map((s) =>
                              s.id === seg.id ? { ...s, start: val } : s
                            ),
                          }));
                          triggerFramePreview(val, `${seg.name} Start`);
                        }}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-indigo-300 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="number"
                        step="0.1"
                        min={seg.start}
                        value={seg.end}
                        onChange={(e) => {
                          const val = Math.max(seg.start + 0.1, parseFloat(e.target.value) || 0);
                          updateCurrentVideoConfig((v) => ({
                            segments: v.segments.map((s) =>
                              s.id === seg.id ? { ...s, end: val } : s
                            ),
                          }));
                          triggerFramePreview(val, `${seg.name} End`);
                        }}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-indigo-300 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-gray-500">s</span>
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 bg-gray-900 px-2.5 py-1 rounded border border-gray-700">
                      <span className="text-xs text-gray-400">{t.segSpeedLabel}</span>
                      <input
                        type="range"
                        min="0.25"
                        max="1.50"
                        step="0.01"
                        disabled={currentVideo.syncLoopRate}
                        value={currentVideo.syncLoopRate ? currentVideo.globalRate : segRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateCurrentVideoConfig((v) => ({
                            segments: v.segments.map((s) =>
                              s.id === seg.id ? { ...s, playbackRate: val } : s
                            ),
                          }));
                        }}
                        className="w-24 accent-rose-500 cursor-pointer disabled:opacity-40"
                      />
                      <span className="text-xs font-mono font-bold text-rose-400 w-11 text-right">
                        {(currentVideo.syncLoopRate ? currentVideo.globalRate : segRate).toFixed(2)}x
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 bg-gray-900 px-2 py-1 rounded border border-gray-700 ${
                        playMode === 'highlights' && highlightsMode === 'merged' ? 'opacity-40' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-400">{t.segRepeatLabel}</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={playMode === 'highlights' && highlightsMode === 'merged'}
                        value={seg.targetLoops}
                        onChange={(e) =>
                          updateCurrentVideoConfig((v) => ({
                            segments: v.segments.map((s) =>
                              s.id === seg.id
                                ? { ...s, targetLoops: Math.max(1, parseInt(e.target.value) || 1) }
                                : s
                            ),
                          }))
                        }
                        className="w-10 bg-gray-800 text-center text-sm font-bold text-rose-400 rounded py-0.5 focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">{t.segRepeatUnit}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        title={t.moveSegUp}
                        disabled={index === 0}
                        onClick={() => moveSegment(index, -1)}
                        className="text-gray-500 hover:text-indigo-300 px-1 py-1 text-xs disabled:opacity-30 disabled:hover:text-gray-500"
                      >
                        ↑
                      </button>
                      <button
                        title={t.moveSegDown}
                        disabled={index === currentVideo.segments.length - 1}
                        onClick={() => moveSegment(index, 1)}
                        className="text-gray-500 hover:text-indigo-300 px-1 py-1 text-xs disabled:opacity-30 disabled:hover:text-gray-500"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => {
                          const updated = currentVideo.segments.filter((_, idx) => idx !== index);
                          const nextIdx = clampIndex(
                            index === activeSegmentIndex
                              ? Math.min(index, updated.length - 1)
                              : index < activeSegmentIndex
                                ? activeSegmentIndex - 1
                                : activeSegmentIndex,
                            updated.length
                          );
                          setActiveSegmentIndex(nextIdx);
                          updateCurrentVideoConfig(() => ({
                            segments: updated,
                            selectedSegmentIndex: nextIdx,
                          }));
                        }}
                        className="text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
