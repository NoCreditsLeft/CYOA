import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

const weightColor = {
  absolute: '#e53e3e',
  strong:   '#dd6b20',
  soft:     '#718096',
};

const categoryLabel = {
  character_fact: 'Character',
  world_rule:     'World',
  relationship:   'Relationship',
  consequence:    'Consequence',
  item:           'Item',
  location:       'Location',
  other:          'Other',
};

export default function FontOfTruth() {
  const [facts, setFacts] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try { setFacts(await api.listCanon()); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.addBreadcrumb(text.trim());
      setText('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    setErr('');
    try {
      await api.deleteCanon(id);
      await load();
    } catch (e) {
      // 409 with locked_uses payload — HIL moment. For now, just show message.
      setErr(e.message);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Font of Truth</h2>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: 0 }}>
        Drop a breadcrumb. Claude parses it into canon.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Rufus doesn't like peanut butter — in fact, it'll kill him."
          rows={2}
          style={{
            flex: 1, padding: 10, fontSize: 14, fontFamily: 'inherit',
            background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6,
          }}
        />
        <button type="submit" disabled={busy || !text.trim()} style={btn}>
          {busy ? 'Parsing…' : 'Add'}
        </button>
      </form>

      {err && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</p>}

      {facts.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: 13 }}>No canon yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {facts.map((f) => (
            <li key={f.id} style={row}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ ...chip, borderColor: weightColor[f.weight] || '#555', color: weightColor[f.weight] || '#aaa' }}>
                  {f.weight}
                </span>
                <span style={chip}>{categoryLabel[f.category] || f.category}</span>
                {f.status !== 'active' && <span style={{ ...chip, borderColor: '#666' }}>{f.status}</span>}
                <button onClick={() => del(f.id)} style={delBtn} title="Delete">×</button>
              </div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{f.content}</div>
              <div style={{ fontSize: 12, opacity: 0.5, fontStyle: 'italic' }}>“{f.raw_input}”</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const btn = {
  padding: '10px 16px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
};
const chip = {
  display: 'inline-block', fontSize: 11, padding: '2px 8px',
  border: '1px solid #444', borderRadius: 999, opacity: 0.9,
};
const row = {
  padding: 12, border: '1px solid #222', borderRadius: 6,
  marginBottom: 8, background: '#141414',
};
const delBtn = {
  marginLeft: 'auto', background: 'transparent', border: '1px solid #444',
  color: '#888', borderRadius: 4, cursor: 'pointer', width: 24, height: 24,
  fontSize: 14, lineHeight: 1,
};
