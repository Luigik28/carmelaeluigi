# Moduli galleria foto/video — guida all'integrazione

Questa repo contiene un sistema completo per caricare, visualizzare ed eliminare foto e video tramite Firebase. I moduli sono progettati per essere copiati in qualsiasi sito statico con modifiche minime.

---

## File da copiare

```
js/
  firebase-config.js   ← MODIFICA questo con le credenziali del tuo progetto
  compress.js          ← copia senza modifiche
  lightbox.js          ← copia senza modifiche
  upload.js            ← copia senza modifiche
css/
  style.css            ← contiene CSS per lightbox, toast, layout base
```

---

## 1. Setup Firebase (una volta sola)

### 1a. Crea il progetto
1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuovo progetto
3. Aggiungi un'app Web e copia la configurazione (`apiKey`, `authDomain`, ecc.)

### 1b. Abilita i servizi
- **Firestore Database** → crea database in modalità produzione
- **Storage** → attiva
- **Authentication** → Sign-in method → Email/Password → abilita (solo per l'admin)

### 1c. Crea l'utente admin
Firebase Console → Authentication → Users → Aggiungi utente
- Email: quella che preferisci
- Password: quella che preferisci

### 1d. Security Rules

**Firestore** (Console → Firestore → Regole):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /uploads/{docId} {
      allow read, create: if true;          // chiunque può leggere e caricare
      allow delete, update: if request.auth != null;  // solo admin autenticato
    }
  }
}
```

**Storage** (Console → Storage → Regole):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, create: if true;
      allow delete, update: if request.auth != null;
    }
  }
}
```

### 1e. CORS per Firebase Storage
Necessario per il download da browser e la generazione di thumbnail.
Dalla **Cloud Shell** (icona `>_` in Google Cloud Console):
```bash
echo '[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gsutil cors set cors.json gs://TUO_BUCKET.firebasestorage.app
```

---

## 2. Configura `js/firebase-config.js`

Sostituisci i valori con quelli del tuo progetto:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

firebase.initializeApp(firebaseConfig);

export const db      = firebase.firestore();
export const storage = firebase.storage();
export const auth    = firebase.auth();
```

---

## 3. Pagina galleria pubblica (`foto.html`)

### Script da includere nell'`<head>` o prima del modulo:
```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

> `firebase-auth-compat.js` è necessario anche sulla pagina pubblica perché `firebase-config.js` esporta `auth = firebase.auth()`. Senza questo script, si ottiene `TypeError: firebase.auth is not a function`.

### HTML minimo necessario:
```html
<!-- Area upload -->
<div id="drop-zone">
  <label for="file-input">Carica</label>
  <input id="file-input" type="file" accept="image/*,video/*" multiple>
</div>
<div id="progress-area"></div>

<!-- Griglia galleria -->
<div id="gallery-grid"></div>

<!-- Toast notifiche -->
<div id="toast" class="toast"></div>
```

### Script di pagina (`type="module"`):
```html
<script type="module">
  import { db, storage }  from './js/firebase-config.js';
  import { initUpload }   from './js/upload.js';
  import { openLightbox } from './js/lightbox.js';

  let items    = [];
  let filtered = [];
  let currentFilter = 'all'; // 'all' | 'image' | 'video'

  async function loadGallery() {
    const snap = await db.collection('uploads').orderBy('createdAt', 'desc').get();
    items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderGallery();
  }

  function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    filtered = currentFilter === 'all' ? [...items] : items.filter(i => i.type === currentFilter);

    grid.innerHTML = filtered.map((item, idx) => {
      if (item.type === 'image') {
        // thumbUrl è la versione 500px; url è il full. Fallback a url se thumb non esiste.
        return `<div class="gallery-item" data-idx="${idx}">
          <img src="${item.thumbUrl || item.url}" loading="lazy">
        </div>`;
      } else {
        return `<div class="gallery-item" data-idx="${idx}">
          <video src="${item.url}" preload="none" muted playsinline></video>
        </div>`;
      }
    }).join('');

    grid.querySelectorAll('.gallery-item').forEach(el => {
      el.addEventListener('click', () => openLightbox(filtered, +el.dataset.idx, 'Titolo condivisione'));
    });
  }

  initUpload({
    fileInputId:    'file-input',
    dropZoneId:     'drop-zone',
    progressAreaId: 'progress-area',
    storage, db,
    collection:  'uploads',   // nome collezione Firestore
    storagePath: 'media',     // cartella in Firebase Storage
    onUploaded: item => { items.unshift(item); renderGallery(); }
  });

  loadGallery();
</script>
```

---

## 4. Pagina admin (`admin.html`)

### Script aggiuntivo (oltre ai tre Firebase):
```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
```

### HTML minimo necessario:
```html
<!-- Form login -->
<div id="login-screen">
  <input id="u" type="email">
  <input id="p" type="password">
  <button id="login-btn">Accedi</button>
  <p id="login-error"></p>
</div>

<!-- Pannello admin (nascosto finché non autenticato) -->
<div id="admin-panel" hidden>
  <button id="logout-btn">Esci</button>
  <div id="admin-grid"></div>
</div>

<div id="toast" class="toast"></div>
```

### Script di pagina (`type="module"`):
```html
<script type="module">
  import { db, storage, auth } from './js/firebase-config.js';
  import { openLightbox }      from './js/lightbox.js';

  const loginScreen = document.getElementById('login-screen');
  const adminPanel  = document.getElementById('admin-panel');
  let items = [];

  // Gestione stato autenticazione
  auth.onAuthStateChanged(user => {
    loginScreen.hidden = !!user;
    adminPanel.hidden  = !user;
    if (user) loadGallery();
  });

  // Login con persistenza opzionale
  async function tryLogin() {
    const email    = document.getElementById('u').value.trim();
    const password = document.getElementById('p').value;
    const remember = false; // true = localStorage, false = sessionStorage
    try {
      await auth.setPersistence(remember
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION);
      await auth.signInWithEmailAndPassword(email, password);
    } catch(e) {
      document.getElementById('login-error').textContent = 'Credenziali non valide';
    }
  }

  document.getElementById('login-btn').addEventListener('click', tryLogin);
  document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

  // Caricamento galleria
  async function loadGallery() {
    const snap = await db.collection('uploads').orderBy('createdAt', 'desc').get();
    items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('admin-grid');
    grid.innerHTML = items.map(item => `
      <div class="admin-item" id="item-${item.id}">
        <img src="${item.thumbUrl || item.url}" loading="lazy">
        <button class="delete-btn" data-id="${item.id}"
          data-path="${item.path || ''}"
          data-thumb-path="${item.thumbPath || ''}">✕</button>
      </div>
    `).join('');

    grid.querySelectorAll('.admin-item').forEach((el, idx) => {
      el.addEventListener('click', () => openLightbox(items, idx, 'Titolo'));
    });

    grid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await db.collection('uploads').doc(btn.dataset.id).delete();
        if (btn.dataset.path)      await storage.ref(btn.dataset.path).delete().catch(() => {});
        if (btn.dataset.thumbPath) await storage.ref(btn.dataset.thumbPath).delete().catch(() => {});
        items = items.filter(i => i.id !== btn.dataset.id);
        renderGrid();
      });
    });
  }
</script>
```

---

## 5. API dei moduli

### `openLightbox(items, idx, shareTitle)`
Apre il lightbox sull'elemento all'indice `idx` nell'array `items`.
- Il lightbox inietta il proprio HTML nel `<body>` al primo utilizzo.
- Supporta navigazione con frecce, swipe, tastiera (Esc/←/→).
- Pulsante ⬇ usa Web Share API su mobile (salva in foto), download blob su desktop.
- `shareTitle` è il titolo usato nella share sheet iOS/Android.

### `initUpload(options)`
| Opzione | Tipo | Default | Descrizione |
|---|---|---|---|
| `fileInputId` | string | — | ID dell'`<input type="file">` |
| `dropZoneId` | string | — | ID del contenitore drag&drop |
| `progressAreaId` | string | — | ID del contenitore barre progresso |
| `storage` | object | — | Istanza `firebase.storage()` |
| `db` | object | — | Istanza `firebase.firestore()` |
| `collection` | string | `'uploads'` | Collezione Firestore |
| `storagePath` | string | `'media'` | Cartella Storage (es. `'matrimonio'`) |
| `onUploaded` | function | — | Callback `(item) => void` dopo upload |

**Struttura documento Firestore salvato:**
```javascript
{
  url:       string,   // URL download full resolution
  thumbUrl:  string,   // URL download thumbnail 500px (null per video)
  type:      'image' | 'video',
  name:      string,   // nome file originale
  path:      string,   // path Storage del file full (per cancellazione)
  thumbPath: string,   // path Storage della thumbnail (per cancellazione)
  createdAt: Timestamp
}
```

### `compressImage(file, maxPx?, quality?)`
Ridimensiona un'immagine via Canvas prima dell'upload. Usata internamente da `upload.js`.
- `maxPx` default `1920` — lato massimo in pixel
- `quality` default `0.82` — qualità JPEG (0–1)
- Restituisce una `Promise<File>`. Se l'immagine è già entro `maxPx`, restituisce il file originale senza ricompressione.

---

## 6. CSS richiesto

Il lightbox usa queste classi (già in `css/style.css`):
`.lightbox`, `.lightbox.open`, `.lightbox-inner`, `.lb-btn`, `.lb-topbar`, `#lb-counter`, `#lb-prev`, `#lb-next`

Il toast usa: `.toast`, `.toast.show`

La regola `[hidden]{display:none!important}` è necessaria perché `display:flex` sulle schermate di login sovrascrive l'attributo HTML `hidden`.

---

## 7. Note importanti

- I moduli usano **ES modules** (`import`/`export`). I tag `<script type="module">` sono deferred per default — le Firebase compat SDK (script regolari) si caricano prima, garantendo che `firebase` sia disponibile come globale.
- `upload.js` usa il globale `firebase.firestore.FieldValue.serverTimestamp()` direttamente — funziona perché i moduli girano dopo i compat SDK.
- La generazione della thumbnail avviene **in parallelo** all'upload full per minimizzare i tempi.
- Per la cancellazione, `pathFromUrl(url)` estrae il path Storage dall'URL di download come fallback per upload precedenti senza il campo `path`.
- **Cache-busting**: iOS Safari e altri browser cachano aggressivamente i moduli ES. Dopo ogni modifica a un file JS o CSS già distribuito, aggiungi o incrementa un query param negli import per forzare il fetch della versione aggiornata:
  ```javascript
  import { openLightbox } from './js/lightbox.js?v=2'; // incrementa v= ad ogni release
  ```
  Stessa cosa per il CSS:
  ```html
  <link rel="stylesheet" href="css/style.css?v=2">
  ```
