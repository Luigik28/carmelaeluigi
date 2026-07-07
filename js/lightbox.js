let _items      = [];
let _idx        = -1;
let _shareTitle = 'Media';
let _ready      = false;

function init() {
  if (_ready) return;
  _ready = true;

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.innerHTML = `
    <div class="lb-topbar">
      <div id="lb-counter"></div>
      <div style="display:flex;gap:.5rem">
        <button class="lb-btn" id="lb-download" aria-label="Scarica">⬇</button>
        <button class="lb-btn" id="lb-close" aria-label="Chiudi">✕</button>
      </div>
    </div>
    <button class="lb-btn" id="lb-prev" aria-label="Precedente">‹</button>
    <div class="lightbox-inner" id="lb-inner"></div>
    <button class="lb-btn" id="lb-next" aria-label="Successivo">›</button>`;
  document.body.appendChild(lb);

  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.getElementById('lb-close').addEventListener('click', close);
  document.getElementById('lb-download').addEventListener('click', download);
  document.getElementById('lb-prev').addEventListener('click', e => { e.stopPropagation(); navigate(-1); });
  document.getElementById('lb-next').addEventListener('click', e => { e.stopPropagation(); navigate(1); });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  let txStart = 0;
  lb.addEventListener('touchstart', e => { txStart = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - txStart;
    if (Math.abs(dx) < 50) return;
    navigate(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function navigate(dir) {
  const next = _idx + dir;
  if (next >= 0 && next < _items.length) { _idx = next; render(); }
}

function render() {
  const item  = _items[_idx];
  const inner = document.getElementById('lb-inner');
  inner.innerHTML = '';
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.url; img.alt = item.name || 'Foto';
    inner.appendChild(img);
  } else {
    const vid = document.createElement('video');
    vid.src = item.url; vid.controls = true; vid.autoplay = true; vid.playsInline = true;
    inner.appendChild(vid);
  }
  document.getElementById('lb-counter').textContent = `${_idx + 1} / ${_items.length}`;
  document.getElementById('lb-prev').style.visibility = _idx === 0 ? 'hidden' : '';
  document.getElementById('lb-next').style.visibility = _idx === _items.length - 1 ? 'hidden' : '';
}

function close() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('lb-inner').innerHTML = '';
}

async function download() {
  const item = _items[_idx];
  const btn  = document.getElementById('lb-download');
  const name = item.name || (item.type === 'video' ? 'video.mp4' : 'foto.jpg');
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const blob = await fetch(item.url).then(r => r.blob());
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: _shareTitle });
    } else {
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: name })
        .dispatchEvent(new MouseEvent('click'));
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch(e) {
    if (e.name !== 'AbortError') window.open(item.url, '_blank');
  } finally {
    btn.textContent = '⬇'; btn.disabled = false;
  }
}

if (document.body) {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}

export function openLightbox(items, idx, shareTitle = 'Media') {
  _items = items;
  _idx = idx;
  _shareTitle = shareTitle;
  render();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
