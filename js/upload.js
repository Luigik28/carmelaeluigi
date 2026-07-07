import { compressImage } from './compress.js?v=3';

/**
 * @param {object} opts
 * @param {string} opts.fileInputId
 * @param {string} opts.dropZoneId
 * @param {string} opts.progressAreaId
 * @param {object} opts.storage        - firebase.storage() instance
 * @param {object} opts.db             - firebase.firestore() instance
 * @param {string} [opts.collection]   - Firestore collection name (default: 'uploads')
 * @param {string} [opts.storagePath]  - Storage folder (default: 'media')
 * @param {function} [opts.onUploaded] - callback(item) after each successful upload
 */
export function initUpload({ fileInputId, dropZoneId, progressAreaId, storage, db,
                             collection = 'uploads', storagePath = 'media', onUploaded }) {
  const fileInput    = document.getElementById(fileInputId);
  const dropZone     = document.getElementById(dropZoneId);
  const progressArea = document.getElementById(progressAreaId);

  fileInput.addEventListener('change', () => { processFiles(fileInput.files); });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    processFiles(e.dataTransfer.files);
  });

  async function processFiles(files) {
    for (const file of files) await uploadFile(file);
    fileInput.value = '';
  }

  async function uploadFile(file) {
    const uid       = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const shortName = file.name.length > 32 ? file.name.slice(0, 30) + '…' : file.name;

    const el = document.createElement('div');
    el.className = 'progress-item';
    el.innerHTML = `
      <div class="progress-name">${shortName}</div>
      <div class="progress-bar-wrap"><div class="progress-bar" id="bar-${uid}"></div></div>
      <div class="progress-status" id="st-${uid}">Ottimizzazione…</div>`;
    progressArea.prepend(el);

    const bar = () => document.getElementById(`bar-${uid}`);
    const st  = () => document.getElementById(`st-${uid}`);

    const isImage   = file.type.startsWith('image/');
    const ts        = Date.now();
    const path      = `${storagePath}/${ts}_${file.name}`;
    const thumbPath = `${storagePath}/thumbs/${ts}_${file.name}`;

    let fullFile = file, thumbPromise = Promise.resolve(null);
    if (isImage) {
      fullFile = await compressImage(file, 1920, 0.82);
      const thumbFile = await compressImage(file, 500, 0.7);
      thumbPromise = storage.ref(thumbPath).put(thumbFile)
        .then(snap => snap.ref.getDownloadURL())
        .catch(() => null);
    }

    if (st()) st().textContent = 'In caricamento…';
    const task = storage.ref(path).put(fullFile);

    return new Promise(resolve => {
      task.on('state_changed',
        snapshot => {
          const pct = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
          if (bar()) bar().style.width = pct + '%';
          if (st())  st().textContent  = pct + '%';
        },
        error => {
          console.error('Upload error:', error);
          if (st()) { st().textContent = '✗ Errore nel caricamento'; st().className = 'progress-status error'; }
          resolve();
        },
        async () => {
          try {
            const [url, thumbUrl] = await Promise.all([
              task.snapshot.ref.getDownloadURL(),
              thumbPromise
            ]);
            const type = isImage ? 'image' : 'video';
            const item = { url, thumbUrl: thumbUrl || null, type, name: file.name,
                           path, thumbPath: isImage ? thumbPath : null };
            await db.collection(collection).add({
              ...item,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (bar()) bar().style.width = '100%';
            if (st())  { st().textContent = '✓ Caricato!'; st().className = 'progress-status done'; }
            onUploaded?.({ ...item, createdAt: null });
          } catch(e) {
            console.error('Firestore error:', e);
            if (st()) { st().textContent = '✗ Errore nel salvataggio'; st().className = 'progress-status error'; }
          }
          resolve();
        }
      );
    });
  }
}
