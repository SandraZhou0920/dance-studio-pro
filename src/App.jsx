import React, { useState, useEffect } from 'react';
import {
  getProjectsByTheme,
  saveProject,
  deleteProject,
} from './utils/projectCache';
import { translations } from './utils/i18n';
import { createPracticeVideoEntry } from './features/practice/createPracticeVideo';
import PracticeWorkspace from './features/practice/PracticeWorkspace';
import ProjectLobby from './features/lobby/ProjectLobby';
import { isEditorReady } from './features/editor';

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
  const [danceProjects, setDanceProjects] = useState([]);
  const [editProjects, setEditProjects] = useState([]);

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

  const handleCreateProject = async (e, theme) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const projectTitle =
      files.length === 1
        ? files[0].name.replace(/\.[^/.]+$/, '')
        : `${files[0].name.replace(/\.[^/.]+$/, '')} (+${files.length - 1})`;

    const newProject = {
      id: `proj-${Date.now()}`,
      theme,
      title: projectTitle,
      videos: files.map((file, idx) => createPracticeVideoEntry(file, idx)),
      activeVideoIndex: 0,
      activeFeatureTab: 'loop',
    };

    const saved = await saveProject(newProject);
    await loadAllProjects();

    if (theme === 'dance') {
      setCurrentProject(saved);
    }
  };

  const handleDeleteProject = async (e, theme, projectId) => {
    e.stopPropagation();
    const list = theme === 'dance' ? danceProjects : editProjects;
    const proj = list.find((p) => p.id === projectId);
    const ok = window.confirm(t.confirmDeleteProject(proj?.title || projectId));
    if (!ok) return;
    await deleteProject(theme, projectId);
    await loadAllProjects();
  };

  const handleOpenProject = (proj) => {
    if (proj.theme === 'edit' && !isEditorReady) {
      alert(t.editAlert);
      return;
    }
    setCurrentProject(proj);
  };

  if (!currentProject) {
    return (
      <ProjectLobby
        t={t}
        lang={lang}
        toggleLanguage={toggleLanguage}
        activeTheme={activeTheme}
        setActiveTheme={setActiveTheme}
        danceProjects={danceProjects}
        editProjects={editProjects}
        onCreateProject={handleCreateProject}
        onOpenPracticeProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
    );
  }

  return (
    <PracticeWorkspace
      project={currentProject}
      setProject={setCurrentProject}
      lang={lang}
      t={t}
      toggleLanguage={toggleLanguage}
      onBackToLobby={() => {
        setCurrentProject(null);
        loadAllProjects();
      }}
    />
  );
}
