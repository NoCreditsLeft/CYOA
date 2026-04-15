import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

const FIELDS = [
  { key: 'voice',             label: 'Voice',             hint: 'Whose lens? e.g. "close 3rd, slightly wry narrator".' },
  { key: 'tone',              label: 'Tone',              hint: 'Mood/register. e.g. "warm, playful, tension in small doses".' },
  { key: 'genre_conventions', label: 'Genre conventions', hint: 'Cozy mystery? Pulp adventure? Folk horror? What beats count?' },
  { key: 'forbidden',         label: 'Forbidden',         hint: 'Hard nos. e.g. "no graphic violence, no romance subplots, no meta jokes".' },
  { key: 'examples',          label: 'Example passages',  hint: 'Paste 1–3 short passages of the desired voice (optional).' },
];

export default function StyleGuide() {
  const [state, setState] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try { setState(await api.getStyle() || {}); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  function set(k, v) { setState((s) => ({ ...s, [k]: v })); }

  async function save() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const patch = Object.fromEntries(FIELDS.map((f) => [f.key, state[f.key] ?? null]));
      await api.saveStyle(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const summary = FIELDS
    .filter((f) => state[f.key])
    .map((f) => f.label.toLowerCase())
    .join(', ') || 'empty';

  return (
    <div style={{ marginTop: 32 }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <h2 style={{ margin: 0 }}>Style Guide</h2>
        <span style={{ opacity: 0.5, fontSize: 13 }}>· {summary}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 12 }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {FIELDS.map((f) => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{f.label}</label>
              <textarea
                value={state[f.key] || ''}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.hint}
                rows={f.key === 'examples' ? 6 : 2}
                style={textarea}
              />
            </div>
          ))}

          <button onClick={save} disabled={saving} style={btn}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>

          {err && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

const textarea = {
  width: '100%', padding: 10, fontSize: 14, fontFamily: 'inherit',
  background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6,
  boxSizing: 'border-box',
};
const btn = {
  padding: '10px 16px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
};
