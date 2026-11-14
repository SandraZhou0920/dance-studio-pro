import React, { useState, useRef, useEffect } from 'react';
import DancePlayer from './components/DancePlayer';
import FreeLoopTimeline from './components/FreeLoopTimeline';
import {
  getProjectsByTheme,
  saveProject,
  deleteProject,
} from './utils/projectCache';
import { translations } from './utils/i18n';

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('studio-lang') || 'zh');
  const t = translations[lang];

  const toggleLanguage = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    localStorage.setItem('studio-lang', next);
  };

  const [activeTheme, setActiveTheme] = useState('dance');
  const [currentProject, setCurrentProject] = useState(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  const [danceProjects, setDanceProjects] = useState([]);
  const [editProjects, setEditProjects] = useState([]);

  const videoRef = useRef(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);

  // 独立 Feature 面板切换：'loop' (段落循环与变速) | 'mirror' (正/镜面区间设置)
  const [activeFeatureTab, setActiveFeatureTab] = useState('loop');

  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [activeMirrorIndex, setActiveMirrorIndex] = useState(0);

  // 播放模式：'single' (单段落循环) | 'highlights' (多段落循环) | 'practice' (练习模式) | 'off' (关闭分段循环)
  const [playMode, setPlayMode] = useState('practice');
  const [highlightsMode, setHighlightsMode] = useState('sequential');

  // 选段或调整起止点时的画面预览提示
  const [previewLabel, setPreviewLabel] = useState(null);
  const previewTimerRef = useRef(null);

  const [statusInfo, setStatusInfo] = useState({
    inLoop: false,
    text: '',
    actualRate: 1.0,
  });

  // 触发画面帧预览（暂停视频并跳转到指定秒数，显示画面定格预览）
  const triggerFramePreview = (targetTime, label) => {
    const video = videoRef.current;
    if (video && !isNaN(targetTime)) {
      video.pause();
      video.currentTime = Math.max(0, Math.min(video.duration || targetTime, targetTime));
    }
    setPreviewLabel(t.previewingBadge(label, targetTime.toFixed(2)));
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewLabel(null);
    }, 2000);
  };

  const loadAllProjects = async () => {
    const [dList, eList] = await Promise.all([
      getProjectsByTheme('dance'),
      getProjectsByTheme('edit'),
    ]);
    setDanceProjects(dList);
    setEditProjects(eList);
  };

  useEffect(() => {
    loadAllProjects();
  }, []);

  useEffect(() => {
    if (!currentProject || !currentProject.videos[activeVideoIndex]) {
      setActiveVideoUrl(null);
      return;
    }
    const file = currentProject.videos[activeVideoIndex].file;
    const url = URL.createObjectURL(file);
    setActiveVideoUrl(url);
    setActiveSegmentIndex(0);
    setActiveMirrorIndex(0);

    return () => URL.revokeObjectURL(url);
  }, [currentProject?.id, activeVideoIndex]);

  const createDefaultVideoEntry = (file, idx) => ({
    id: `vid-${Date.now()}-${idx}`,
    name: file.name,
    file,
    segments: [
      {
        id: `seg-${Date.now()}-${idx}`,
        name: t.defaultSegName(1),
        start: 0,
        end: 4,
        targetLoops: 3,
        playbackRate: 0.75,
      },
    ],
    mirrorZones: [],
    mirrorStrategy: 'auto',
    globalRate: 1.0,
    syncLoopRate: false,
    loopFullTrack: true,
  });

  const handleCreateProject = async (e, theme) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const projectTitle =
      files.length === 1
        ? files[0].name.replace(/\.[^/.]+$/, '')
        : `${files[0].name.replace(/\.[^/.]+$/, '')} (+${files.length - 1})`;

    const videoEntries = files.map((file, idx) => createDefaultVideoEntry(file, idx));

    const newProject = {
      id: `proj-${Date.now()}`,
      theme,
      title: projectTitle,
      videos: videoEntries,
    };

    const saved = await saveProject(newProject);
    await loadAllProjects();

    if (theme === 'dance') {
      setCurrentProject(saved);
      setActiveVideoIndex(0);
    }
  };

  const handleAddVideosToProject = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !currentProject) return;

    const newEntries = files.map((file, idx) => createDefaultVideoEntry(file, idx));

    const updatedProject = {
      ...currentProject,
      videos: [...currentProject.videos, ...newEntries],
    };

    const saved = await saveProject(updatedProject);
    setCurrentProject(saved);
    setActiveVideoIndex(saved.videos.length - newEntries.length);
    await loadAllProjects();
  };

  const handleRemoveVideoFromProject = async (e, idxToRemove) => {
    e.stopPropagation();
    if (!currentProject || currentProject.videos.length <= 1) return;

    const updatedVideos = currentProject.videos.filter((_, idx) => idx !== idxToRemove);
    const updatedProject = { ...currentProject, videos: updatedVideos };
    const saved = await saveProject(updatedProject);

    setCurrentProject(saved);
    if (activeVideoIndex >= updatedVideos.length) {
      setActiveSegmentIndex(0);
      setActiveVideoIndex(updatedVideos.length - 1);
    }
    await loadAllProjects();
  };

  const updateCurrentVideoConfig = async (updater) => {
    if (!currentProject) return;
    const updatedVideos = currentProject.videos.map((vid, idx) =>
      idx === activeVideoIndex ? { ...vid, ...updater(vid) } : vid
    );
    const updatedProject = { ...currentProject, videos: updatedVideos };
    setCurrentProject(updatedProject);
    await saveProject(updatedProject);
  };

  const handleDeleteProject = async (e, theme, projectId) => {
    e.stopPropagation();
    await deleteProject(theme, projectId);
    await loadAllProjects();
  };

  const currentVideo = currentProject?.videos[activeVideoIndex];

  useEffect(() => {
    if (!currentVideo) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const currentSeg = currentVideo.segments[activeSegmentIndex];
      const video = videoRef.current;

      if (e.key.toLowerCase() === 'a' && currentSeg && video) {
        const now = Number(video.currentTime.toFixed(2));
        updateCurrentVideoConfig((v) => ({
          segments: v.segments.map((s, i) =>
            i === activeSegmentIndex
              ? { ...s, start: now, end: now >= s.end ? now + 3 : s.end }
              : s
          ),
        }));
      } else if (e.key.toLowerCase() === 'b' && currentSeg && video) {
        const now = Number(video.currentTime.toFixed(2));
        updateCurrentVideoConfig((v) => ({
          segments: v.segments.map((s, i) =>
            i === activeSegmentIndex
              ? { ...s, start: now <= s.start ? Math.max(0, now - 3) : s.start, end: now }
              : s
          ),
        }));
      } else if (e.key === '[' || e.key === '-') {
        if (statusInfo.inLoop && !currentVideo.syncLoopRate && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? { ...s, playbackRate: Math.max(0.25, Number(((s.playbackRate ?? 0.75) - 0.05).toFixed(2))) }
                : s
            ),
          }));
        } else {
          updateCurrentVideoConfig((v) => ({
            globalRate: Math.max(0.25, Number((v.globalRate - 0.05).toFixed(2))),
          }));
        }
      } else if (e.key === ']' || e.key === '=') {
        if (statusInfo.inLoop && !currentVideo.syncLoopRate && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? { ...s, playbackRate: Math.min(1.5, Number(((s.playbackRate ?? 0.75) + 0.05).toFixed(2))) }
                : s
            ),
          }));
        } else {
          updateCurrentVideoConfig((v) => ({
            globalRate: Math.min(1.5, Number((v.globalRate + 0.05).toFixed(2))),
          }));
        }
      } else if (e.code === 'Space' && video) {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentVideo, activeSegmentIndex, statusInfo.inLoop]);

  // =========================================================================
  // 视图 A：开始页面（双主题项目大厅）
  // =========================================================================
  if (!currentProject) {
    const displayedProjects = activeTheme === 'dance' ? danceProjects : editProjects;

    return (
      <div className="min-h-screen bg-gray-950 text-white p-8 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-8">
          <div className="flex justify-end">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300 cursor-pointer transition"
            >
              {lang === 'zh' ? 'English' : '中文'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t.appTitle}</h1>
            <p className="text-sm text-gray-400">{t.appSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setActiveTheme('dance')}
              className={`p-6 rounded-2xl border text-left transition cursor-pointer ${
                activeTheme === 'dance'
                  ? 'bg-indigo-950/50 border-indigo-500 shadow-lg shadow-indigo-950/40'
                  : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400">
                  CHOREOGRAPHY LAB
                </span>
                <span className="text-xs bg-indigo-600/30 text-indigo-300 px-2.5 py-1 rounded-full">
                  {t.cachedProjectsCount(danceProjects.length)}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">{t.themeDanceTitle}</h2>
              <p className="text-xs text-gray-400 mt-1.5">{t.themeDanceDesc}</p>
            </button>

            <button
              onClick={() => setActiveTheme('edit')}
              className={`p-6 rounded-2xl border text-left transition cursor-pointer ${
                activeTheme === 'edit'
                  ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/40'
                  : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-rose-400">
                  VIDEO STUDIO
                </span>
                <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
                  {t.cachedProjectsCount(editProjects.length)} · {t.comingSoonTag}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">{t.themeEditTitle}</h2>
              <p className="text-xs text-gray-400 mt-1.5">{t.themeEditDesc}</p>
            </button>
          </div>

          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {activeTheme === 'dance' ? t.myDanceLibrary : t.myEditLibrary}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{t.multiSelectHint}</p>
              </div>

              <label
                className={`px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition ${
                  activeTheme === 'dance'
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {activeTheme === 'dance' ? t.newDanceProject : t.newEditProject}
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => handleCreateProject(e, activeTheme)}
                  className="hidden"
                />
              </label>
            </div>

            {displayedProjects.length === 0 ? (
              <div className="text-center py-14 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                <p className="text-sm">{t.emptyProjects}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedProjects.map((proj) => {
                  const totalSizeMB =
                    proj.videos.reduce((acc, v) => acc + v.file.size, 0) / (1024 * 1024);
                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        if (activeTheme === 'edit') {
                          alert(t.editAlert);
                          return;
                        }
                        setCurrentProject(proj);
                        setActiveVideoIndex(0);
                      }}
                      className="bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer transition flex flex-col justify-between gap-4 group"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-semibold text-base text-white group-hover:text-indigo-300 line-clamp-1">
                            {proj.title}
                          </h4>
                          <button
                            onClick={(e) => handleDeleteProject(e, activeTheme, proj.id)}
                            className="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded"
                          >
                            {t.deleteBtn}
                          </button>
                        </div>

                        <div className="mt-3 space-y-1">
                          {proj.videos.map((v, i) => (
                            <div
                              key={v.id}
                              className="text-xs text-gray-400 flex items-center gap-2 truncate"
                            >
                              <span className="text-indigo-400 font-mono text-[11px]">
                                0{i + 1}
                              </span>
                              <span className="truncate">{v.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-gray-500 border-t border-gray-700/80 pt-2.5">
                        <span>{t.videoCountAndSize(proj.videos.length, totalSizeMB.toFixed(1))}</span>
                        <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 视图 B：扒舞项目工作台
  // =========================================================================
  const activeSeg = currentVideo?.segments[activeSegmentIndex];
  const mirrorZones = currentVideo?.mirrorZones ?? [];
  const activeMirrorZone = mirrorZones[activeMirrorIndex];
  const isFullLoop = currentVideo?.loopFullTrack ?? true;
  const mirrorStrategy = currentVideo?.mirrorStrategy ?? 'auto';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-5 flex flex-col gap-4">
      <header className="flex flex-wrap justify-between items-center border-b border-gray-800 pb-3 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCurrentProject(null);
              loadAllProjects();
            }}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 cursor-pointer"
          >
            {t.backToLobby}
          </button>

          <input
            type="text"
            value={currentProject.title}
            onChange={async (e) => {
              const updated = { ...currentProject, title: e.target.value };
              setCurrentProject(updated);
              await saveProject(updated);
            }}
            className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-indigo-500 text-lg font-bold focus:outline-none px-1"
          />

          {activeVideoUrl && statusInfo.text && (
            <div
              className={`text-xs px-3 py-1 rounded-full border flex items-center gap-2 ${
                statusInfo.inLoop
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700'
                  : 'bg-gray-900 text-gray-300 border-gray-700'
              }`}
            >
              <span>{statusInfo.text}</span>
              <span className="font-mono font-bold text-indigo-400">
                ({statusInfo.actualRate.toFixed(2)}x)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300 cursor-pointer"
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>

          <label className="bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium">
            {t.addVideosToProject}
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={handleAddVideosToProject}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* 项目内多视频切换标签栏 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {t.projectAssets(currentProject.videos.length)}
        </span>
        {currentProject.videos.map((vid, idx) => {
          const isSelected = idx === activeVideoIndex;
          return (
            <div
              key={vid.id}
              onClick={() => setActiveVideoIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <span className="max-w-[180px] truncate">{vid.name}</span>
              {currentProject.videos.length > 1 && (
                <button
                  onClick={(e) => handleRemoveVideoFromProject(e, idx)}
                  className={`ml-1 hover:text-red-300 ${
                    isSelected ? 'text-indigo-200' : 'text-gray-500'
                  }`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentVideo && activeVideoUrl && (
        <>
          {/* 1. 视频播放器 */}
          <DancePlayer
            videoRef={videoRef}
            videoUrl={activeVideoUrl}
            segments={currentVideo.segments}
            mirrorZones={mirrorZones}
            mirrorStrategy={mirrorStrategy}
            activeSegmentIndex={activeSegmentIndex}
            setActiveSegmentIndex={setActiveSegmentIndex}
            playMode={playMode}
            highlightsMode={highlightsMode}
            loopFullTrack={isFullLoop}
            globalRate={currentVideo.globalRate}
            syncLoopRate={currentVideo.syncLoopRate}
            previewLabel={previewLabel}
            onStatusUpdate={setStatusInfo}
            t={t}
          />

          {/* 2. 独立 Feature 切换标签栏：段落循环与变速 vs 正/镜面区间设置 */}
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <button
              onClick={() => setActiveFeatureTab('loop')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold cursor-pointer transition border-b-2 ${
                activeFeatureTab === 'loop'
                  ? 'bg-gray-900 text-indigo-400 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-200 border-transparent'
              }`}
            >
              {t.tabLoopFeature}
            </button>

            <button
              onClick={() => setActiveFeatureTab('mirror')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold cursor-pointer transition border-b-2 ${
                activeFeatureTab === 'mirror'
                  ? 'bg-gray-900 text-cyan-400 border-cyan-500'
                  : 'text-gray-400 hover:text-gray-200 border-transparent'
              }`}
            >
              {t.tabMirrorFeature}
            </button>
          </div>

          {/* 3. 音频波形时间轴 */}
          <FreeLoopTimeline
            videoUrl={activeVideoUrl}
            editTarget={activeFeatureTab}
            segments={currentVideo.segments}
            mirrorZones={mirrorZones}
            activeSegmentId={activeSeg?.id}
            activeMirrorId={activeMirrorZone?.id}
            syncLoopRate={currentVideo.syncLoopRate}
            globalRate={currentVideo.globalRate}
            onSelectSegment={(id) => {
              const idx = currentVideo.segments.findIndex((s) => s.id === id);
              if (idx !== -1) {
                setActiveSegmentIndex(idx);
                triggerFramePreview(currentVideo.segments[idx].start, currentVideo.segments[idx].name);
              }
            }}
            onSelectMirrorZone={(id) => {
              const idx = mirrorZones.findIndex((z) => z.id === id);
              if (idx !== -1) {
                setActiveMirrorIndex(idx);
                triggerFramePreview(mirrorZones[idx].start, mirrorZones[idx].name);
              }
            }}
            onUpdateSegment={(segId, updates) => {
              updateCurrentVideoConfig((v) => ({
                segments: v.segments.map((s) => (s.id === segId ? { ...s, ...updates } : s)),
              }));
            }}
            onUpdateMirrorZone={(zoneId, updates) => {
              updateCurrentVideoConfig((v) => ({
                mirrorZones: (v.mirrorZones || []).map((z) =>
                  z.id === zoneId ? { ...z, ...updates } : z
                ),
              }));
            }}
            onAddSegment={(start, end) => {
              const newSeg = {
                id: `seg-${Date.now()}`,
                name: t.defaultSegName(currentVideo.segments.length + 1),
                start,
                end,
                targetLoops: 3,
                playbackRate: 0.75,
              };
              updateCurrentVideoConfig((v) => {
                const updated = [...v.segments, newSeg].sort((a, b) => a.start - b.start);
                setActiveSegmentIndex(updated.findIndex((s) => s.id === newSeg.id));
                return { segments: updated };
              });
            }}
            onAddMirrorZone={(start, end) => {
              const newZone = {
                id: `mir-${Date.now()}`,
                name: t.defaultMirrorName(mirrorZones.length + 1),
                start,
                end,
                isMirrored: true,
              };
              updateCurrentVideoConfig((v) => {
                const updated = [...(v.mirrorZones || []), newZone].sort(
                  (a, b) => a.start - b.start
                );
                setActiveMirrorIndex(updated.findIndex((z) => z.id === newZone.id));
                return { mirrorStrategy: 'auto', mirrorZones: updated };
              });
            }}
            onPreviewFrame={triggerFramePreview}
            onSeek={(time) => {
              if (videoRef.current) videoRef.current.currentTime = time;
            }}
            t={t}
          />

          {/* =============================================================== */}
          {/* 段落循环与变速面板                                              */}
          {/* =============================================================== */}
          {activeFeatureTab === 'loop' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
                <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
                  <div className="text-xs text-gray-400 font-medium">{t.playModeLabel}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. 单段落循环 */}
                    <button
                      onClick={() => setPlayMode('single')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                        playMode === 'single'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {t.modeSingle}
                    </button>

                    {/* 2. 多段落循环 */}
                    <button
                      onClick={() => setPlayMode('highlights')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                        playMode === 'highlights'
                          ? 'bg-rose-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {t.modeHighlights}
                    </button>

                    {/* 3. 练习模式（全曲 + 段落循环） */}
                    <button
                      onClick={() => setPlayMode('practice')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                        playMode === 'practice'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {t.modePractice}
                    </button>

                    {/* 4. 关闭分段循环 */}
                    <button
                      onClick={() => setPlayMode('off')}
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
                        onClick={() => setHighlightsMode('sequential')}
                        className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition ${
                          highlightsMode === 'sequential'
                            ? 'bg-rose-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {t.highlightsSequential}
                      </button>
                      <button
                        onClick={() => setHighlightsMode('merged')}
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

                {/* 整支舞基准速度滑块 */}
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

              {/* 循环段落独立配置列表 */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-sm font-semibold text-gray-200">{t.segmentListTitle}</h2>
                  <button
                    onClick={() => {
                      if (!videoRef.current) return;
                      const start = Number(videoRef.current.currentTime.toFixed(2));
                      const end = Number(
                        Math.min(videoRef.current.duration || start + 4, start + 4).toFixed(2)
                      );
                      const newSeg = {
                        id: `seg-${Date.now()}`,
                        name: t.defaultSegName(currentVideo.segments.length + 1),
                        start,
                        end,
                        targetLoops: 3,
                        playbackRate: 0.75,
                      };
                      updateCurrentVideoConfig((v) => {
                        const updated = [...v.segments, newSeg].sort((a, b) => a.start - b.start);
                        setActiveSegmentIndex(updated.findIndex((s) => s.id === newSeg.id));
                        return { segments: updated };
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {t.addSegmentBtn}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {currentVideo.segments.map((seg, index) => {
                    const isActive = index === activeSegmentIndex;
                    const segRate = seg.playbackRate ?? 0.75;

                    return (
                      <div
                        key={seg.id}
                        onClick={() => {
                          setActiveSegmentIndex(index);
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
                              {(currentVideo.syncLoopRate ? currentVideo.globalRate : segRate).toFixed(
                                2
                              )}
                              x
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1 bg-gray-900 px-2 py-1 rounded border border-gray-700 ${
                              playMode === 'highlights' && highlightsMode === 'merged'
                                ? 'opacity-40'
                                : ''
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

                          {currentVideo.segments.length > 1 && (
                            <button
                              onClick={() => {
                                const updated = currentVideo.segments.filter((_, idx) => idx !== index);
                                updateCurrentVideoConfig(() => ({ segments: updated }));
                                if (activeSegmentIndex >= updated.length) {
                                  setActiveSegmentIndex(updated.length - 1);
                                }
                              }}
                              className="text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 正 / 镜面区间独立设置面板                                       */}
          {/* =============================================================== */}
          {activeFeatureTab === 'mirror' && (
            <div className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium mr-1">
                    {t.mirrorStrategyLabel}
                  </span>
                  <button
                    onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'auto' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                      mirrorStrategy === 'auto'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t.mirrorModeAuto}
                  </button>
                  <button
                    onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'forceOn' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                      mirrorStrategy === 'forceOn'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t.mirrorModeForceOn}
                  </button>
                  <button
                    onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'forceOff' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                      mirrorStrategy === 'forceOff'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t.mirrorModeForceOff}
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (!videoRef.current) return;
                    const start = Number(videoRef.current.currentTime.toFixed(2));
                    const end = Number(
                      Math.min(videoRef.current.duration || start + 6, start + 6).toFixed(2)
                    );
                    const newZone = {
                      id: `mir-${Date.now()}`,
                      name: t.defaultMirrorName(mirrorZones.length + 1),
                      start,
                      end,
                      isMirrored: true,
                    };
                    updateCurrentVideoConfig((v) => {
                      const updated = [...(v.mirrorZones || []), newZone].sort(
                        (a, b) => a.start - b.start
                      );
                      setActiveMirrorIndex(updated.findIndex((z) => z.id === newZone.id));
                      return { mirrorStrategy: 'auto', mirrorZones: updated };
                    });
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {t.addMirrorZoneBtn}
                </button>
              </div>

              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                <h2 className="text-sm font-semibold text-cyan-300 mb-3">{t.mirrorListTitle}</h2>

                {mirrorZones.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
                    {lang === 'zh'
                      ? '当前暂无自定义镜面区间。你可以在上方波形图直接拖动鼠标框选，或点击右上角「+ 在当前秒数添加翻转区间」'
                      : 'No mirror zones configured yet. Drag directly on the waveform above or click "+ Add Mirror Zone Here".'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {mirrorZones.map((zone, index) => {
                      const isSelected = index === activeMirrorIndex;
                      return (
                        <div
                          key={zone.id}
                          onClick={() => {
                            setActiveMirrorIndex(index);
                            triggerFramePreview(zone.start, zone.name);
                          }}
                          className={`flex flex-wrap items-center justify-between p-3 rounded-lg border transition cursor-pointer gap-3 ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500'
                              : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isSelected ? 'bg-cyan-500 text-gray-950' : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {index + 1}
                            </span>

                            <input
                              type="text"
                              value={zone.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateCurrentVideoConfig((v) => ({
                                  mirrorZones: v.mirrorZones.map((z) =>
                                    z.id === zone.id ? { ...z, name: e.target.value } : z
                                  ),
                                }))
                              }
                              className="bg-transparent border-b border-gray-600 focus:border-cyan-400 text-sm font-medium w-28 focus:outline-none"
                            />

                            <div
                              className="flex items-center gap-1.5 text-xs font-mono"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={zone.start}
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  updateCurrentVideoConfig((v) => ({
                                    mirrorZones: v.mirrorZones.map((z) =>
                                      z.id === zone.id ? { ...z, start: val } : z
                                    ),
                                  }));
                                  triggerFramePreview(val, `${zone.name} Start`);
                                }}
                                className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-cyan-300 focus:outline-none focus:border-cyan-500"
                              />
                              <span className="text-gray-500">→</span>
                              <input
                                type="number"
                                step="0.1"
                                min={zone.start}
                                value={zone.end}
                                onChange={(e) => {
                                  const val = Math.max(
                                    zone.start + 0.1,
                                    parseFloat(e.target.value) || 0
                                  );
                                  updateCurrentVideoConfig((v) => ({
                                    mirrorZones: v.mirrorZones.map((z) =>
                                      z.id === zone.id ? { ...z, end: val } : z
                                    ),
                                  }));
                                  triggerFramePreview(val, `${zone.name} End`);
                                }}
                                className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-cyan-300 focus:outline-none focus:border-cyan-500"
                              />
                              <span className="text-gray-500">s</span>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                updateCurrentVideoConfig((v) => ({
                                  mirrorStrategy: 'auto',
                                  mirrorZones: v.mirrorZones.map((z) =>
                                    z.id === zone.id ? { ...z, isMirrored: !z.isMirrored } : z
                                  ),
                                }))
                              }
                              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition ${
                                zone.isMirrored
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {zone.isMirrored ? t.mirrorToggleBtnOn : t.mirrorToggleBtnOff}
                            </button>

                            <button
                              onClick={() => {
                                const updated = mirrorZones.filter((_, idx) => idx !== index);
                                updateCurrentVideoConfig(() => ({ mirrorZones: updated }));
                                if (activeMirrorIndex >= updated.length) {
                                  setActiveMirrorIndex(Math.max(0, updated.length - 1));
                                }
                              }}
                              className="text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}