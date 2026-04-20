import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

export default function Pages({ onEpisodeLoad }) {
  const [episode, setEpisode] = useState(null);
  const [pages, setPages] = useState([]);
  const [steering, setSteering] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    try {
      const r = await api.listPages();
      setEpisode(r.episode);
      onEpisodeLoad?.(r.episode);
      setPages(r.pages || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true); setErr('');
    try {
      // If there's a current draft, discard it first (regenerate semantics).
      const existingDraft = pages.find((p) => p.status === 'draft');
      if (existingDraft) {
        await api.discardPage(existingDraft.id);
      }
      await api.generatePage(steering.trim() || undefined);
      setSteering('');
      await load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function lock(page, option) {
    setErr('');
    try {
      await api.lockPage(page.id, option);
      await load();
    } catch (e) { setErr(e.message); }
  }

  async function discard(page) {
    setErr('');
    try {
      await api.discardPage(page.id);
      await load();
    } catch (e) { setErr(e.message); }
  }

  async function copyPage(p) {
    const text = `Page ${p.sequence}\n\n${p.content}\n\nOptions:\n${p.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  async function copyAll() {
    const text = pages.map((p) => {
      const chosen = p.choices?.[0]?.chosen_option;
      return `Page ${p.sequence}\n\n${p.content}${chosen ? `\n\n> Community chose: ${chosen}` : ''}`;
    }).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
  }

  const draft = pages.find((p) => p.status === 'draft');

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Pages {episode && <span style={{ opacity: 0.5, fontSize: 14, fontWeight: 400 }}>· {episode.title}</span>}</h2>

      <div style={{ marginBottom: 16 }}>
        <textarea
          value={steering}
          onChange={(e) => setSteering(e.target.value)}
          placeholder={draft
            ? "Steering for a fresh draft (the current draft will be discarded)"
            : "Optional steering: tone, a beat you want hit, a character to feature, etc."}
          rows={2}
          style={textarea}
        />
        <button onClick={generate} disabled={busy} style={btn}>
          {busy
            ? (draft ? 'Regenerating…' : 'Generating…')
            : (draft ? 'Regenerate draft' : 'Generate next page')}
        </button>
      </div>

      {err && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</p>}

      {pages.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={copyAll} style={ghostBtn}>Copy whole episode so far</button>
        </div>
      )}

      {pages.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: 13 }}>No pages yet.</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {pages.map((p) => {
            const chosen = p.choices?.[0]?.chosen_option;
            return (
              <li key={p.id} style={{
                ...pageBox,
                borderColor: p.status === 'draft' ? '#2b6cb0' : '#222',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={chip}>Page {p.sequence}</span>
                  <span style={{ ...chip, color: p.status === 'draft' ? '#2b6cb0' : '#718096' }}>{p.status}</span>
                  {p.status === 'draft' && (
                    <button onClick={() => discard(p)} style={{ ...ghostBtn, marginLeft: 'auto', color: '#ff6b6b', borderColor: '#663' }}>
                      Discard
                    </button>
                  )}
                  <button onClick={() => copyPage(p)} style={{ ...ghostBtn, marginLeft: p.status === 'draft' ? 8 : 'auto' }}>
                    {copiedId === p.id ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>

                <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>
                  {p.content}
                </div>

                <div>
                  {p.options.map((o) => {
                    const isChosen = chosen === o;
                    return (
                      <div key={o} style={{
                        ...option,
                        borderColor: isChosen ? '#48bb78' : '#333',
                        opacity: p.status === 'draft' || isChosen ? 1 : 0.5,
                      }}>
                        <span>{o}</span>
                        {p.status === 'draft' && (
                          <button onClick={() => lock(p, o)} style={lockBtn}>Lock this</button>
                        )}
                        {isChosen && <span style={{ color: '#48bb78', fontSize: 12 }}>✓ chosen</span>}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const btn = {
  padding: '10px 16px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', marginTop: 8,
};
const ghostBtn = {
  padding: '4px 10px', background: 'transparent', color: '#aaa',
  border: '1px solid #444', borderRadius: 4, fontSize: 12, cursor: 'pointer',
};
const lockBtn = {
  padding: '4px 10px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
};
const textarea = {
  width: '100%', padding: 10, fontSize: 14, fontFamily: 'inherit',
  background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6,
  boxSizing: 'border-box',
};
const chip = {
  display: 'inline-block', fontSize: 11, padding: '2px 8px',
  border: '1px solid #444', borderRadius: 999, opacity: 0.9,
};
const pageBox = {
  padding: 16, border: '1px solid', borderRadius: 6, marginBottom: 12, background: '#141414',
};
const option = {
  padding: 10, border: '1px solid', borderRadius: 4, marginBottom: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  background: '#0f0f0f',
};
