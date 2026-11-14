const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

/** 从系统选择器里留下真正能读的视频（过滤照片、空 iCloud 占位）。 */
export function pickVideoFiles(fileList) {
  return Array.from(fileList || []).filter((file) => {
    if (!file || file.size <= 0) return false;
    if (file.type.startsWith('video/')) return true;
    return VIDEO_EXT.test(file.name);
  });
}
