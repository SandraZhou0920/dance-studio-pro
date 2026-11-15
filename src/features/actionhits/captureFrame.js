export function captureVideoFrame(video) {
  const w = video?.videoWidth;
  const h = video?.videoHeight;
  if (!video || !w || !h) {
    return Promise.reject(new Error('no-frame'));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('blob-failed'));
        else resolve(blob);
      },
      'image/jpeg',
      0.88
    );
  });
}

export function waitForSeek(video, time) {
  return new Promise((resolve) => {
    if (!video) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish);
    try {
      video.pause();
      video.currentTime = Math.max(0, Number(time) || 0);
    } catch {
      finish();
      return;
    }
    window.setTimeout(finish, 500);
  });
}

export function createActionShot({ blob, time, name, hitId }) {
  return {
    id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: Number(Number(time).toFixed(3)),
    name,
    hitId: hitId || null,
    blob,
  };
}
