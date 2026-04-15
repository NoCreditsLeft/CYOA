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

  // Conflict resolution state
  const [conflict, setConflict] = useState(null); // { text, parsed, conflicts }

  async function load() {
    try { setFacts(await api.listCanon()); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.addBreadcrumb(text.trim());
      setText('');
      await load();
    } catch (e) {
      if (e.status === 409 && e.body?.needs_resolution) {
        setConflict({ text: text.trim(), parsed: e.body.parsed, conflicts: e.body.conflicts });
      } else {
        setErr(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    setErr('');
    try { await api.deleteCanon(id); await load(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Font of Truth</h2>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: 0 }}>
        Drop a breadcrumb. Claude parses it into canon. Contradictions require reconciliation.
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
                {f.reconciles?.length > 0 && <span style={{ ...chip, borderColor: '#805ad5', color: '#b794f4' }}>reconciles</span>}
                <button onClick={() => del(f.id)} style={delBtn} title="Delete">×</button>
              </div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{f.content}</div>
              <div style={{ fontSize: 12, opacity: 0.5, fontStyle: 'italic' }}>“{f.raw_input}”</div>
              {f.resolution_note && (
                <div style={{ fontSize: 12, marginTop: 6, padding: 8, borderLeft: '2px solid #805ad5', background: '#1a1324' }}>
                  <strong style={{ color: '#b794f4' }}>Resolution:</strong> {f.resolution_note}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {conflict && (
        <ConflictModal
          conflict={conflict}
          onClose={() => setConflict(null)}
          onResolved={async () => { setConflict(null); setText(''); await load(); }}
        />
      )}
    </div>
  );
}

function ConflictModal({ conflict, onClose, onResolved }) {
  const [mode, setMode] = useState('reconcile');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    if (!explanation.trim()) { setErr('Explanation required'); return; }
    setBusy(true); setErr('');
    try {
      await api.resolveBreadcrumb(conflict.text, conflict.parsed, {
        mode,
        targets: conflict.conflicts.map((c) => c.id),
        explanation: explanation.trim(),
      });
      onResolved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px' }}>Contradiction</h3>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>New fact</div>
          <div style={{ padding: 10, background: '#141414', borderRadius: 4 }}>
            [{conflict.parsed.weight.toUpperCase()}] {conflict.parsed.content}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Contradicts</div>
          {conflict.conflicts.map((c) => (
            <div key={c.id} style={{ padding: 10, background: '#141414', borderRadius: 4, marginBottom: 6 }}>
              <div style={{ fontSize: 14 }}>[{c.weight?.toUpperCase()}] {c.content}</div>
              <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>{c.reason}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="radio" value="reconcile" checked={mode === 'reconcile'}
              onChange={() => setMode('reconcile')}
              style={{ marginRight: 6 }}
            />
            <strong>Reconcile</strong> — both stay, you write the rule that lets them coexist
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio" value="supersede" checked={mode === 'supersede'}
              onChange={() => setMode('supersede')}
              style={{ marginRight: 6 }}
            />
            <strong>Supersede</strong> — new fact wins, the old one is retracted
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Explanation (required)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            placeholder={
              mode === 'reconcile'
                ? 'e.g. If Rufus takes his antidote from Nana, he can safely eat peanut butter for 24 hours.'
                : 'e.g. The old fact was based on a false diagnosis — Rufus was actually never allergic.'
            }
            style={textarea}
          />
        </div>

        {err && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={ghostBtn} disabled={busy}>Cancel</button>
          <button onClick={confirm} style={btn} disabled={busy || !explanation.trim()}>
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: '10px 16px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
};
const ghostBtn = {
  padding: '10px 16px', background: 'transparent', color: '#aaa',
  border: '1px solid #444', borderRadius: 6, fontSize: 14, cursor: 'pointer',
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
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modal = {
  width: 560, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
  padding: 20, background: '#0d0d0d', border: '1px solid #333', borderRadius: 8,
};
const textarea = {
  width: '100%', padding: 10, fontSize: 14, fontFamily: 'inherit',
  background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6,
  boxSizing: 'border-box',
};
