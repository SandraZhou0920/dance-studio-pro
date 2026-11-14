import { isEditorReady } from '../editor';

export default function ProjectLobby({
  t,
  lang,
  toggleLanguage,
  activeTheme,
  setActiveTheme,
  danceProjects,
  editProjects,
  onCreateProject,
  onOpenPracticeProject,
  onDeleteProject,
}) {
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
                onChange={(e) => onCreateProject(e, activeTheme)}
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
                      if (activeTheme === 'edit' && !isEditorReady) {
                        alert(t.editAlert);
                        return;
                      }
                      onOpenPracticeProject(proj);
                    }}
                    className="bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer transition flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-base text-white group-hover:text-indigo-300 line-clamp-1">
                          {proj.title}
                        </h4>
                        <button
                          onClick={(e) => onDeleteProject(e, activeTheme, proj.id)}
                          className="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded"
                        >
                          {t.deleteBtn}
                        </button>
                      </div>
                      <div className="mt-3 space-y-1">
                        {proj.videos.map((v, i) => (
                          <div key={v.id} className="text-xs text-gray-400 flex items-center gap-2 truncate">
                            <span className="text-indigo-400 font-mono text-[11px]">
                              {String(i + 1).padStart(2, '0')}
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
