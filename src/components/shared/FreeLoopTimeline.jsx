import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

const waitForWidth = (el, timeoutMs = 4000) =>
  new Promise((resolve) => {
    if (el.clientWidth > 8) {
      resolve(el.clientWidth);
      return;
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 8) {
        ro.disconnect();
        resolve(el.clientWidth);
      }
    });
    ro.observe(el);
    setTimeout(() => {
      ro.disconnect();
      resolve(el.clientWidth);
    }, timeoutMs);
  });

const waitForDuration = (video, timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (video?.duration && Number.isFinite(video.duration) && video.duration > 0) {
      resolve(video.duration);
      return;
    }
    const finish = () => {
      const d = video?.duration;
      resolve(Number.isFinite(d) && d > 0 ? d : 1);
    };
    video?.addEventListener('loadedmetadata', finish, { once: true });
    video?.addEventListener('durationchange', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });

/** Safari/微信无法把 MP4 当音频解码，用可见占位峰保证时间轴始终能框选 */
const buildPlaceholderPeaks = (bars = 480) => {
  const data = new Float32Array(bars);
  for (let i = 0; i < bars; i += 1) {
    const t = i / bars;
    data[i] =
      0.18 +
      0.55 * Math.abs(Math.sin(t * Math.PI * 22)) * (0.35 + 0.65 * Math.sin(t * Math.PI));
  }
  return [data];
};

const canDecodeVideoAsAudio = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return !/iPhone|iPad|iPod|MicroMessenger/i.test(ua);
};

export default function FreeLoopTimeline({
  videoUrl,
  videoRef,            // 与播放器共用同一时间轴，仅同步光标，不接管 <video>
  editTarget,          // 'loop' | 'mirror' —— 决定当前时间轴操作的是循环段还是镜面区间
  segments,
  mirrorZones,
  activeSegmentId,
  activeMirrorId,
  syncLoopRate,
  globalRate,
  onSelectSegment,
  onSelectMirrorZone,
  onUpdateSegment,
  onUpdateMirrorZone,
  onAddSegment,
  onAddMirrorZone,
  onPreviewFrame,      // 拖动边缘或选中时，实时让播放器画面跳到对应秒数预览
  onSeek,
  t,
}) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const syncingFromVideoRef = useRef(false);
  const [timelineReady, setTimelineReady] = useState(0);

  // 使用 ref 保持最新回调，避免 WaveSurfer 闭包过期
  const callbacksRef = useRef({
    editTarget,
    onSelectSegment,
    onSelectMirrorZone,
    onUpdateSegment,
    onUpdateMirrorZone,
    onAddSegment,
    onAddMirrorZone,
    onPreviewFrame,
    onSeek,
  });

  useEffect(() => {
    callbacksRef.current = {
      editTarget,
      onSelectSegment,
      onSelectMirrorZone,
      onUpdateSegment,
      onUpdateMirrorZone,
      onAddSegment,
      onAddMirrorZone,
      onPreviewFrame,
      onSeek,
    };
  });

  useEffect(() => {
    if (!videoUrl || !containerRef.current) return;

    const container = containerRef.current;
    let cancelled = false;
    let rafId = 0;
    let syncCancelled = false;
    let resizeObserver = null;
    let ws = null;

    const boot = async () => {
      await waitForWidth(container);
      const duration = await waitForDuration(videoRef?.current);
      if (cancelled || !container.isConnected) return;

      ws = WaveSurfer.create({
        container,
        waveColor: '#9ca3af',
        progressColor: '#818cf8',
        cursorColor: '#f43f5e',
        height: 90,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        normalize: true,
        // 不传 url：手机端解码 MP4 会失败导致整条轴空白
        peaks: buildPlaceholderPeaks(),
        duration,
        interact: true,
        dragToSeek: true,
        autoplay: false,
        fillParent: true,
      });

      const wsRegions = ws.registerPlugin(RegionsPlugin.create());
      wsRef.current = ws;
      regionsPluginRef.current = wsRegions;

      ws.setMuted(true);
      ws.setVolume(0);
      ws.on('play', () => ws.pause());

      ws.on('ready', () => {
        if (cancelled) return;
        ws.pause();
        ws.setMuted(true);
        wsRegions.enableDragSelection({
          color: 'rgba(99, 102, 241, 0.3)',
        });
        const video = videoRef?.current;
        if (video && !Number.isNaN(video.currentTime)) {
          syncingFromVideoRef.current = true;
          ws.setTime(video.currentTime);
          syncingFromVideoRef.current = false;
        }
        setTimelineReady((n) => n + 1);
      });

      ws.on('interaction', (newTime) => {
        if (syncingFromVideoRef.current) return;
        callbacksRef.current.onSeek?.(newTime);
      });

      const syncPlayhead = () => {
        if (syncCancelled || !ws) return;
        const video = videoRef?.current;
        if (video && ws.getDuration()) {
          const videoTime = video.currentTime || 0;
          if (Math.abs(ws.getCurrentTime() - videoTime) > 0.03) {
            syncingFromVideoRef.current = true;
            ws.setTime(videoTime);
            syncingFromVideoRef.current = false;
          }
        }
        rafId = requestAnimationFrame(syncPlayhead);
      };
      rafId = requestAnimationFrame(syncPlayhead);

      resizeObserver = new ResizeObserver(() => {
        if (!ws || cancelled) return;
        const width = container.clientWidth;
        if (width > 8) ws.setOptions({ width });
      });
      resizeObserver.observe(container);

      wsRegions.on('region-created', (newRegion) => {
        if (newRegion.id.startsWith('seg-') || newRegion.id.startsWith('mir-')) return;
        const regionStart = Number(newRegion.start.toFixed(2));
        const regionEnd = Number(newRegion.end.toFixed(2));
        newRegion.remove();

        if (regionEnd - regionStart > 0.25) {
          if (callbacksRef.current.editTarget === 'mirror') {
            callbacksRef.current.onAddMirrorZone(regionStart, regionEnd);
          } else {
            callbacksRef.current.onAddSegment(regionStart, regionEnd);
          }
          callbacksRef.current.onPreviewFrame?.(regionStart, `${regionStart.toFixed(2)}s`);
        }
      });

      wsRegions.on('region-updated', (region, side) => {
        const regionStart = Number(region.start.toFixed(2));
        const regionEnd = Number(region.end.toFixed(2));
        const previewTime = side === 'end' ? regionEnd : regionStart;

        if (region.id.startsWith('seg-')) {
          callbacksRef.current.onUpdateSegment(region.id, { start: regionStart, end: regionEnd });
          callbacksRef.current.onPreviewFrame?.(
            previewTime,
            `${side === 'end' ? 'End' : 'Start'} ${previewTime.toFixed(2)}s`
          );
        } else if (region.id.startsWith('mir-')) {
          callbacksRef.current.onUpdateMirrorZone(region.id, { start: regionStart, end: regionEnd });
          callbacksRef.current.onPreviewFrame?.(
            previewTime,
            `Mirror ${side === 'end' ? 'End' : 'Start'} ${previewTime.toFixed(2)}s`
          );
        }
      });

      wsRegions.on('region-clicked', (region, e) => {
        e.stopPropagation();
        if (region.id.startsWith('seg-')) {
          callbacksRef.current.onSelectSegment(region.id);
        } else if (region.id.startsWith('mir-')) {
          callbacksRef.current.onSelectMirrorZone(region.id);
        }
      });

      if (canDecodeVideoAsAudio()) {
        ws.load(videoUrl).catch(() => {
          if (cancelled) return;
          ws.setOptions({ peaks: buildPlaceholderPeaks(), duration });
        });
      }
    };

    boot();

    return () => {
      cancelled = true;
      syncCancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      ws?.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
    };
  }, [videoUrl, videoRef]);

  // 根据当前处于「循环 Feature」还是「镜面 Feature」，渲染对应的可交互区间
  useEffect(() => {
    const wsRegions = regionsPluginRef.current;
    if (!wsRegions) return;

    wsRegions.clearRegions();

    if (editTarget === 'mirror') {
      // 镜面设置模式下：全部渲染镜面区间，可自由选中与拖拽
      (mirrorZones || []).forEach((zone, index) => {
        const isSelected = zone.id === activeMirrorId;
        wsRegions.addRegion({
          id: zone.id,
          start: zone.start,
          end: zone.end,
          content: `#${index + 1} ${zone.name}`,
          color: isSelected ? 'rgba(6, 182, 212, 0.45)' : 'rgba(6, 182, 212, 0.25)',
          drag: true,
          resize: true,
        });
      });
    } else {
      // 循环设置模式下：渲染所有循环段
      segments.forEach((seg, index) => {
        const isActive = seg.id === activeSegmentId;
        const displayRate = syncLoopRate ? globalRate : (seg.playbackRate ?? 0.75);
        wsRegions.addRegion({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          content: `#${index + 1} ${seg.name} (${seg.targetLoops}${t.segRepeatUnit} · ${displayRate.toFixed(2)}x)`,
          color: isActive ? 'rgba(244, 63, 94, 0.45)' : 'rgba(99, 102, 241, 0.28)',
          drag: true,
          resize: true,
        });
      });
    }
  }, [editTarget, segments, mirrorZones, activeSegmentId, activeMirrorId, syncLoopRate, globalRate, t, timelineReady]);

  return (
    <div className="w-full bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
        <span>
          {editTarget === 'mirror' ? t.timelineHintMirror : t.timelineHintLoop}
        </span>
        <span className={editTarget === 'mirror' ? 'text-cyan-400' : 'text-indigo-400'}>
          {editTarget === 'mirror'
            ? t.timelineTotalMirror((mirrorZones || []).length)
            : t.timelineTotalLoop(segments.length)}
        </span>
      </div>
      <div
        ref={containerRef}
        dir="ltr"
        className="w-full min-h-[90px] rounded-lg bg-gray-800 overflow-hidden touch-none"
      />
    </div>
  );
}