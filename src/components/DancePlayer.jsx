import React, { useState, useEffect, useRef } from 'react';

export default function DancePlayer({
  videoRef,
  videoUrl,
  segments,
  mirrorZones,
  mirrorStrategy,
  activeSegmentIndex,
  setActiveSegmentIndex,
  playMode,
  highlightsMode,
  loopFullTrack,
  globalRate,
  syncLoopRate,
  previewLabel,
  onStatusUpdate,
  t,
}) {
  const [scale, setScale] = useState(1);
  const [effectiveMirrored, setEffectiveMirrored] = useState(false);
  // 控制是否启用丝滑过渡动画（正常播放跨区间时为 true，手动拖拽进度条时瞬切为 false）
  const [smoothMirrorTransition, setSmoothMirrorTransition] = useState(true);

  const currentLoopCountRef = useRef(1);
  const completedSegIdsRef = useRef(new Set());
  const lastSegIdRef = useRef(null);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    currentLoopCountRef.current = 1;
    completedSegIdsRef.current.clear();
    lastSegIdRef.current = null;
  }, [playMode, highlightsMode, videoUrl]);

  const computeMirrorAtTime = (time) => {
    if (mirrorStrategy === 'forceOn') return true;
    if (mirrorStrategy === 'forceOff') return false;
    const matchedZone = (mirrorZones || []).find(
      (z) => z.isMirrored && time >= z.start && time <= z.end
    );
    return Boolean(matchedZone);
  };

  // 手动切换全局镜面策略或调整区间时，也保持丝滑翻转过渡
  useEffect(() => {
    setSmoothMirrorTransition(true);
    const video = videoRef.current;
    const tNow = video ? video.currentTime : 0;
    setEffectiveMirrored(computeMirrorAtTime(tNow));
  }, [mirrorZones, mirrorStrategy, videoUrl]);

  useEffect(() => {
    let animationFrameId;

    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const now = video.currentTime;
        const vidDuration = video.duration || 0;

        // 实时同步当前帧镜面状态
        const shouldMirror = computeMirrorAtTime(now);
        setEffectiveMirrored((prev) => {
          if (prev !== shouldMirror) {
            // 如果正在手动拖动进度条，瞬时切换不拖泥带水；正常播放跨越区间边界时，开启丝滑翻牌动画
            setSmoothMirrorTransition(!isSeekingRef.current && !video.seeking);
            return shouldMirror;
          }
          return prev;
        });

        if (!video.paused) {
          const getSegRate = (seg) =>
            syncLoopRate ? globalRate : (seg.playbackRate ?? globalRate);

          if (
            loopFullTrack &&
            vidDuration &&
            now >= vidDuration - 0.08 &&
            playMode !== 'single' &&
            playMode !== 'highlights'
          ) {
            completedSegIdsRef.current.clear();
            lastSegIdRef.current = null;
            currentLoopCountRef.current = 1;
            video.currentTime = 0;
            video.play().catch(() => {});
            animationFrameId = requestAnimationFrame(tick);
            return;
          }

          if (segments.length > 0 && playMode === 'single') {
            const currentSeg = segments[activeSegmentIndex];
            if (currentSeg) {
              const segRate = getSegRate(currentSeg);
              if (Math.abs(video.playbackRate - segRate) > 0.005) {
                video.playbackRate = segRate;
              }
              onStatusUpdate({
                inLoop: true,
                text: t.statusLooping(currentSeg.name, currentLoopCountRef.current, '∞'),
                actualRate: segRate,
              });

              if (now >= currentSeg.end || now < currentSeg.start - 0.15) {
                currentLoopCountRef.current += 1;
                video.currentTime = currentSeg.start;
              }
            }
          } else if (segments.length > 0 && playMode === 'practice') {
            segments.forEach((seg) => {
              if (now < seg.start - 0.2 && completedSegIdsRef.current.has(seg.id)) {
                completedSegIdsRef.current.delete(seg.id);
              }
            });

            const matchedIndex = segments.findIndex(
              (seg) =>
                !completedSegIdsRef.current.has(seg.id) &&
                now >= seg.start &&
                now <= seg.end + 0.15
            );

            if (matchedIndex !== -1) {
              const seg = segments[matchedIndex];
              const segRate = getSegRate(seg);

              if (lastSegIdRef.current !== seg.id) {
                lastSegIdRef.current = seg.id;
                currentLoopCountRef.current = 1;
                setActiveSegmentIndex(matchedIndex);
              }

              if (Math.abs(video.playbackRate - segRate) > 0.005) {
                video.playbackRate = segRate;
              }

              onStatusUpdate({
                inLoop: true,
                text: t.statusLooping(seg.name, currentLoopCountRef.current, seg.targetLoops),
                actualRate: segRate,
              });

              if (now >= seg.end) {
                if (currentLoopCountRef.current < seg.targetLoops) {
                  currentLoopCountRef.current += 1;
                  video.currentTime = seg.start;
                } else {
                  completedSegIdsRef.current.add(seg.id);
                  lastSegIdRef.current = null;
                }
              }
            } else {
              if (Math.abs(video.playbackRate - globalRate) > 0.005) {
                video.playbackRate = globalRate;
              }
              onStatusUpdate({
                inLoop: false,
                text: loopFullTrack ? t.statusNormalFull : t.statusNormal,
                actualRate: globalRate,
              });
            }
          } else if (segments.length > 0 && playMode === 'highlights') {
            const currentSeg = segments[activeSegmentIndex];
            if (currentSeg) {
              const segRate = getSegRate(currentSeg);
              if (Math.abs(video.playbackRate - segRate) > 0.005) {
                video.playbackRate = segRate;
              }

              if (now < currentSeg.start - 0.2) {
                video.currentTime = currentSeg.start;
              }

              if (highlightsMode === 'merged') {
                onStatusUpdate({
                  inLoop: true,
                  text: t.statusMerged(currentSeg.name, activeSegmentIndex + 1, segments.length),
                  actualRate: segRate,
                });

                if (now >= currentSeg.end) {
                  const nextIndex = (activeSegmentIndex + 1) % segments.length;
                  setActiveSegmentIndex(nextIndex);
                  video.currentTime = segments[nextIndex].start;
                }
              } else {
                onStatusUpdate({
                  inLoop: true,
                  text: t.statusLooping(currentSeg.name, currentLoopCountRef.current, currentSeg.targetLoops),
                  actualRate: segRate,
                });

                if (now >= currentSeg.end) {
                  if (currentLoopCountRef.current < currentSeg.targetLoops) {
                    currentLoopCountRef.current += 1;
                    video.currentTime = currentSeg.start;
                  } else {
                    const nextIndex = (activeSegmentIndex + 1) % segments.length;
                    currentLoopCountRef.current = 1;
                    setActiveSegmentIndex(nextIndex);
                    video.currentTime = segments[nextIndex].start;
                  }
                }
              }
            }
          } else {
            if (Math.abs(video.playbackRate - globalRate) > 0.005) {
              video.playbackRate = globalRate;
            }
            onStatusUpdate({
              inLoop: false,
              text: loopFullTrack ? t.statusFreeFull : t.statusFree,
              actualRate: globalRate,
            });
          }
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    segments,
    mirrorZones,
    mirrorStrategy,
    activeSegmentIndex,
    playMode,
    highlightsMode,
    loopFullTrack,
    globalRate,
    syncLoopRate,
    videoRef,
    t,
  ]);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.12;
    setScale((prev) =>
      e.deltaY < 0 ? Math.min(prev + zoomSpeed, 4) : Math.max(prev - zoomSpeed, 0.5)
    );
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const handleScrub = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '00:00.00';
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2).padStart(5, '0');
    return `${String(mins).padStart(2, '0')}:${secs}`;
  };

  const videoEl = videoRef.current;
  const currentTime = videoEl ? videoEl.currentTime : 0;
  const duration = videoEl ? videoEl.duration || 0 : 0;
  const isPlaying = videoEl ? !videoEl.paused : false;

  return (
    <div className="w-full bg-black rounded-xl border border-gray-800 overflow-hidden flex flex-col select-none">
      {/* 视频画面区域 */}
      <div
        className="relative w-full h-[46vh] overflow-hidden flex items-center justify-center bg-black"
        onWheel={handleWheel}
      >
        {/* 外层容器：负责快速跟手的滚轮缩放 */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
          style={{
            transform: `scale(${scale})`,
          }}
        >
          {/* 内层容器：独立负责丝滑的水平镜面翻转（GPU 合成层加速 + 缓出曲线） */}
          <div
            className="w-full h-full flex items-center justify-center will-change-transform"
            style={{
              transform: effectiveMirrored ? 'scaleX(-1)' : 'scaleX(1)',
              transition: smoothMirrorTransition
                ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              onClick={togglePlay}
              onSeeking={() => {
                isSeekingRef.current = true;
              }}
              onSeeked={() => {
                isSeekingRef.current = false;
                // 定位完成后恢复丝滑过渡状态，供后续播放使用
                requestAnimationFrame(() => setSmoothMirrorTransition(true));
              }}
              onEnded={() => {
                completedSegIdsRef.current.clear();
                lastSegIdRef.current = null;
                currentLoopCountRef.current = 1;
                if (loopFullTrack && videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="max-h-full max-w-full cursor-pointer"
            />
          </div>
        </div>

        {/* 左上角：当前镜面状态（颜色同步平滑渐变） */}
        <div
          className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-medium border backdrop-blur-sm transition-colors duration-300 ${
            effectiveMirrored
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
              : 'bg-black/75 border-gray-700 text-gray-300'
          }`}
        >
          {effectiveMirrored ? t.mirrorBadgeOn : t.mirrorBadgeOff}
        </div>

        {/* 顶部中央：选择或拖动段落边缘时的画面实时预览提示 */}
        {previewLabel && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/95 text-gray-950 px-3.5 py-1 rounded-full text-xs font-bold shadow-lg">
            {previewLabel}
          </div>
        )}

        {/* 右上角：缩放状态 */}
        <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg flex items-center gap-3 text-xs border border-gray-700">
          <span>
            {t.zoomLabel} {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(1)}
            className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            {t.resetSize}
          </button>
        </div>
      </div>

      {/* 视频底部内置时间轴控制栏（永远严格保持从左到右 dir="ltr"） */}
      <ProgressBarFooter
        videoRef={videoRef}
        segments={segments}
        mirrorZones={mirrorZones}
        activeSegmentIndex={activeSegmentIndex}
        togglePlay={togglePlay}
        handleScrub={handleScrub}
        formatSeconds={formatSeconds}
        t={t}
      />
    </div>
  );
}

// 独立拆分底部进度条刷新组件，避免每帧 60fps 的秒数跳动触发外层视频容器重渲染，进一步提升画面流畅度
function ProgressBarFooter({
  videoRef,
  segments,
  mirrorZones,
  activeSegmentIndex,
  togglePlay,
  handleScrub,
  formatSeconds,
  t,
}) {
  const [timeState, setTimeState] = useState({ current: 0, duration: 0, isPlaying: false });

  useEffect(() => {
    let rafId;
    const syncTime = () => {
      const v = videoRef.current;
      if (v) {
        setTimeState((prev) => {
          const cur = v.currentTime;
          const dur = v.duration || 0;
          const playing = !v.paused;
          if (
            Math.abs(prev.current - cur) < 0.01 &&
            prev.duration === dur &&
            prev.isPlaying === playing
          ) {
            return prev;
          }
          return { current: cur, duration: dur, isPlaying: playing };
        });
      }
      rafId = requestAnimationFrame(syncTime);
    };
    rafId = requestAnimationFrame(syncTime);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef]);

  const { current, duration, isPlaying } = timeState;

  return (
    <div
      dir="ltr"
      className="bg-gray-900/95 border-t border-gray-800 px-4 py-2.5 flex items-center gap-3"
    >
      <button
        onClick={togglePlay}
        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
      >
        {isPlaying ? t.pauseBtn : t.playBtn}
      </button>

      <div className="text-xs font-mono text-gray-200 whitespace-nowrap bg-gray-950 px-2.5 py-1 rounded border border-gray-800">
        <span className="text-indigo-400 font-bold">{current.toFixed(2)}s</span>
        <span className="text-gray-500 mx-1">/</span>
        <span className="text-gray-400">{duration.toFixed(2)}s</span>
        <span className="text-gray-600 ml-2 hidden sm:inline">
          ({formatSeconds(current)})
        </span>
      </div>

      <div className="relative flex-1 flex items-center h-6">
        <div className="absolute inset-x-0 h-2 bg-gray-800 rounded-full overflow-hidden pointer-events-none">
          {duration > 0 &&
            (mirrorZones || []).map(
              (z) =>
                z.isMirrored && (
                  <div
                    key={z.id}
                    style={{
                      left: `${(z.start / duration) * 100}%`,
                      width: `${((z.end - z.start) / duration) * 100}%`,
                    }}
                    className="absolute top-0 bottom-0 bg-cyan-500/40"
                  />
                )
            )}
          {duration > 0 &&
            segments.map((seg, idx) => (
              <div
                key={seg.id}
                style={{
                  left: `${(seg.start / duration) * 100}%`,
                  width: `${((seg.end - seg.start) / duration) * 100}%`,
                }}
                className={`absolute top-0 bottom-0 ${
                  idx === activeSegmentIndex ? 'bg-rose-500/80' : 'bg-indigo-500/50'
                }`}
              />
            ))}
        </div>

        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={current}
          onChange={handleScrub}
          className="relative z-10 w-full accent-rose-500 cursor-pointer bg-transparent"
        />
      </div>
    </div>
  );
}