const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

/**
 * 同时放行照片和视频，macOS 图库里的 HEVC/MOV 才不会被「打开」按钮禁用。
 * 真正是否当视频用，仍由 pickVideoFiles 过滤。
 */
export const LIBRARY_MEDIA_ACCEPT = [
  'image/*',
  'video/*',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/hevc',
  'video/webm',
  '.mp4',
  '.mov',
  '.m4v',
  '.MP4',
  '.MOV',
  '.heic',
].join(',');

function looksLikeMp4(buffer) {
  if (!buffer || buffer.byteLength < 12) return false;
  const mark = new TextDecoder('latin1').decode(buffer.slice(4, 8));
  return mark === 'ftyp';
}

async function materializeFile(file) {
  if (file.size > 0) return file;
  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) return null;
  return new File([buf], file.name || 'photo-library.mov', {
    type: file.type || 'video/mp4',
  });
}

function isVideoFile(file, head) {
  if (file.type.startsWith('video/')) return true;
  if (VIDEO_EXT.test(file.name)) return true;
  if (file.type.startsWith('image/')) return false;
  return looksLikeMp4(head);
}

/** 从图库 / 文件夹 / 拖放里留下能播的视频（含无扩展名的 Photos 导出）。 */
export async function pickVideoFiles(fileList) {
  const out = [];
  for (const raw of Array.from(fileList || [])) {
    if (!raw) continue;
    let file = raw;
    try {
      file = (await materializeFile(raw)) || raw;
    } catch {
      continue;
    }
    let head = null;
    try {
      head = await file.slice(0, 16).arrayBuffer();
    } catch {
      head = null;
    }
    if (file.size <= 0 && (!head || head.byteLength === 0)) continue;
    if (isVideoFile(file, head)) out.push(file);
  }
  return out;
}
