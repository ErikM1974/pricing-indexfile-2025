// Artwork uploader — drag/drop + preview + placement chips + Caspio hosted upload.
// Uploads to /api/files/upload (same caspio-pricing-proxy endpoint 3-Day Tees uses,
// see pages/js/3-day-tees.js:773) so we get a real hosted URL to send to ShopWorks.
// The base64 preview stays for UI thumbnails; the hostedUrl is what's sent in the payload.
const PLACEMENTS = ['Left Chest', 'Full Front', 'Full Back', 'Sleeve L', 'Sleeve R', 'Nape', 'Hat Front'];
const CASPIO_UPLOAD_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload';
const CASPIO_FILES_URL  = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/';

function uploadArtworkToCaspio(file) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve({
            externalKey: result.externalKey,
            hostedUrl: `${CASPIO_FILES_URL}${result.externalKey}`,
            serverName: result.fileName,
            serverSize: result.size
          });
        } catch (err) { reject(err); }
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.open('POST', CASPIO_UPLOAD_URL);
    xhr.send(fd);
  });
}

function Artwork({ files, setFiles }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  // Build the local record (id + base64 preview for image files) AND stash the raw File so we can upload it.
  function readFile(file) {
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve({ id, name: file.name, size: file.size, preview: null, _rawFile: file, placements: ['Left Chest'], designNo: '' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        id, name: file.name, size: file.size, preview: e.target.result,
        _rawFile: file,
        placements: ['Left Chest'],
        designNo: '',
      });
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const parsed = await Promise.all([...fileList].map(readFile));
    // Strip _rawFile before storing in state (we'll use it here for the upload, not in state).
    const toStore = parsed.map(({ _rawFile, ...rest }) => ({ ...rest, uploading: true }));
    setFiles(prev => [...prev, ...toStore]);

    // Upload each file to Caspio and patch the hostedUrl back into state.
    for (const p of parsed) {
      try {
        const result = await uploadArtworkToCaspio(p._rawFile);
        setFiles(prev => prev.map(f => f.id === p.id ? { ...f, hostedUrl: result.hostedUrl, externalKey: result.externalKey, uploading: false } : f));
      } catch (err) {
        console.error('[OrderForm] Artwork upload failed for', p.name, err);
        setFiles(prev => prev.map(f => f.id === p.id ? { ...f, uploadError: err.message, uploading: false } : f));
      }
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }
  function onChange(e) { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }
  function remove(id) { setFiles(files.filter(f => f.id !== id)); }
  function togglePlacement(id, p) {
    setFiles(files.map(f => f.id === id ? { ...f, placements: f.placements.includes(p) ? f.placements.filter(x => x !== p) : [...f.placements, p] } : f));
  }
  function updateDesignNo(id, v) {
    setFiles(files.map(f => f.id === id ? { ...f, designNo: v } : f));
  }
  function updateColors(id, v) {
    setFiles(files.map(f => f.id === id ? { ...f, colors: v } : f));
  }
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="upload-grid">
      <label
        className={"dropzone" + (drag ? ' drag' : '')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,.ai,.eps,.pdf,.svg" onChange={onChange} />
        <div className="dz-icon"><Icon name="upload" size={28} stroke={1.4} /></div>
        <div className="dz-title">Drop artwork or click to browse</div>
        <div className="dz-sub">PNG · JPG · SVG · AI · EPS · PDF</div>
      </label>

      {files.map(f => (
        <div className="artwork-card" key={f.id}>
          <div className="artwork-thumb">
            {f.preview
              ? <img src={f.preview} alt={f.name} />
              : <div className="ph">{(f.name.split('.').pop() || 'FILE').toUpperCase()}</div>}
          </div>
          <div className="artwork-meta">
            <div style={{ minWidth: 0 }}>
              <div className="name" title={f.name}>{f.name}</div>
              <div className="size">
                {fmtSize(f.size)}
                {f.uploading && <span style={{marginLeft:8,color:'var(--ink-3)'}}>· Uploading…</span>}
                {f.uploadError && <span style={{marginLeft:8,color:'#b3261e'}}>· Upload failed</span>}
                {f.hostedUrl && !f.uploading && !f.uploadError && <span style={{marginLeft:8,color:'var(--accent)',fontWeight:600}}>· Uploaded</span>}
              </div>
            </div>
            <button className="btn icon subtle" onClick={() => remove(f.id)} aria-label="Remove">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div style={{ padding: '10px 14px 0', borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                Design #
              </label>
              <input
                className="cell-input mono"
                placeholder="DSN-0000"
                value={f.designNo || ''}
                onChange={(e) => updateDesignNo(f.id, e.target.value)}
                style={{ border: '1px solid var(--line)', marginBottom: 4 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                PMS / Thread colors
              </label>
              <input
                className="cell-input"
                placeholder="PMS 186, PMS 2925, White"
                value={f.colors || ''}
                onChange={(e) => updateColors(f.id, e.target.value)}
                style={{ border: '1px solid var(--line)', marginBottom: 4 }}
              />
            </div>
          </div>
          <div className="artwork-placement">
            {PLACEMENTS.map(p => (
              <button
                key={p}
                type="button"
                className={"place-chip" + ((f.placements || []).includes(p) ? ' on' : '')}
                onClick={() => togglePlacement(f.id, p)}
              >{p}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Artwork });
