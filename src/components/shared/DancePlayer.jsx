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
  playerScale,
  onScaleChange,
  t,
}) {
  const [scale, setScale] = useState(playerScale ?? 1);
  const [effectiveMirrored, setEffectiveMirrored] = useState(false);
  const scaleSaveTimerRef = useRef(null);
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

  useEffect(() => {
    setScale(playerScale ?? 1);
  }, [videoUrl]);

  // iOS / 微信：禁止原生全屏，避免全屏控件跟着镜面一起翻转
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true');
    video.setAttribute('x5-video-player-type', 'h5');
    video.setAttribute('x5-video-player-fullscreen', 'false');
    video.setAttribute('controlslist', 'nofullscreen nodownload noremoteplayback');

    const keepInline = () => {
      try {
        if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen();
        if (document.fullscreenElement === video) document.exitFullscreen();
        if (video.webkitPresentationMode && video.webkitPresentationMode !== 'inline') {
          video.webkitSetPresentationMode('inline');
        }
      } catch {
        /* older WebKit */
      }
    };

    const onBeginFullscreen = (e) => {
      e.preventDefault?.();
      keepInline();
    };

    video.addEventListener('webkitbeginfullscreen', onBeginFullscreen);
    video.addEventListener('webkitpresentationmodechanged', keepInline);
    video.addEventListener('fullscreenchange', keepInline);
    video.addEventListener('play', keepInline);
    keepInline();

    return () => {
      video.removeEventListener('webkitbeginfullscreen', onBeginFullscreen);
      video.removeEventListener('webkitpresentationmodechanged', keepInline);
      video.removeEventListener('fullscreenchange', keepInline);
      video.removeEventListener('play', keepInline);
    };
  }, [videoRef, videoUrl]);

  const computeMirrorAtTime = (time) => {
    if (mirrorStrategy === 'forceOn') return true;
    if (mirrorStrategy === 'forceOff') return false;
    return (mirrorZones || []).some((z) => time >= z.start && time <= z.end);
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

        if (!video.paused && !isSeekingRef.current && !video.seeking) {
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

              if (now >= currentSeg.end) {
                currentLoopCountRef.current += 1;
                video.currentTime = currentSeg.start;
              } else if (now < currentSeg.start - 0.15) {
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

  const commitScale = (next) => {
    setScale(next);
    if (scaleSaveTimerRef.current) clearTimeout(scaleSaveTimerRef.current);
    scaleSaveTimerRef.current = setTimeout(() => {
      onScaleChange?.(next);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (scaleSaveTimerRef.current) clearTimeout(scaleSaveTimerRef.current);
    };
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.12;
    setScale((prev) => {
      const next =
        e.deltaY < 0 ? Math.min(prev + zoomSpeed, 4) : Math.max(prev - zoomSpeed, 0.5);
      if (scaleSaveTimerRef.current) clearTimeout(scaleSaveTimerRef.current);
      scaleSaveTimerRef.current = setTimeout(() => {
        onScaleChange?.(next);
      }, 400);
      return next;
    });
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const handleScrub = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const raw = parseFloat(e.target.value);
    if (!Number.isFinite(raw)) return;
    isSeekingRef.current = true;
    const dur = video.duration;
    const next =
      Number.isFinite(dur) && dur > 0 ? Math.min(Math.max(0, raw), Math.max(0, dur - 0.05)) : raw;
    try {
      if (typeof video.fastSeek === 'function') video.fastSeek(next);
      else video.currentTime = next;
    } catch {
      video.currentTime = next;
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
    <div
      dir="ltr"
      className="w-full bg-black rounded-xl border border-gray-800 overflow-hidden flex flex-col select-none"
    >
      {/* 视频画面区域：控件/角标绝不能放进带 transform 的祖先里（iOS 会把整页当全屏层翻转） */}
      <div
        className="relative w-full h-[46vh] overflow-hidden flex items-center justify-center bg-black"
        onWheel={handleWheel}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          preload="auto"
          playsInline
          muted={false}
          disablePictureInPicture
          controls={false}
          controlsList="nofullscreen nodownload noremoteplayback"
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="false"
          onClick={togglePlay}
          onSeeking={() => {
            isSeekingRef.current = true;
          }}
          onSeeked={() => {
            isSeekingRef.current = false;
            requestAnimationFrame(() => setSmoothMirrorTransition(true));
          }}
          onEnded={() => {
            const video = videoRef.current;
            if (!video) return;

            if (segments.length > 0 && (playMode === 'single' || playMode === 'highlights')) {
              const currentSeg = segments[activeSegmentIndex] || segments[0];
              video.currentTime = currentSeg.start;
              video.play().catch(() => {});
              return;
            }

            completedSegIdsRef.current.clear();
            lastSegIdRef.current = null;
            currentLoopCountRef.current = 1;
            if (loopFullTrack) {
              video.currentTime = 0;
              video.play().catch(() => {});
            }
          }}
          className="max-h-full max-w-full cursor-pointer will-change-transform"
          style={{
            transform: `scale(${scale}) scaleX(${effectiveMirrored ? -1 : 1})`,
            transformOrigin: 'center center',
            transition: smoothMirrorTransition
              ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
        />

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
            onClick={() => commitScale(1)}
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
            (mirrorZones || []).map((z) => (
              <div
                key={z.id}
                style={{
                  left: `${(z.start / duration) * 100}%`,
                  width: `${((z.end - z.start) / duration) * 100}%`,
                }}
                className="absolute top-0 bottom-0 bg-cyan-500/40"
              />
            ))}
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