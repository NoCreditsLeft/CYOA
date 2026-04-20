import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

const statusColor = {
  proposed: '#d69e2e',
  active: '#38a169',
  complete: '#718096',
};

export default function Chapters({ episode, onEpisodeUpdate }) {
  const [chapters, setChapters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [steering, setSteering] = useState('');

  // Episode goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  async function loadChapters() {
    try { setChapters(await api.listChapters()); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { loadChapters(); }, []);

  async function saveGoal() {
    if (!goalDraft.trim()) return;
    setBusy(true); setErr('');
    try {
      const updated = await api.setEpisodeGoal(goalDraft.trim());
      onEpisodeUpdate?.(updated);
      setEditingGoal(false);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function propose() {
    setBusy(true); setErr('');
    try {
      await api.proposeChapter(steering.trim() || undefined);
      setSteering('');
      await loadChapters();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function activate(id) {
    setBusy(true); setErr('');
    try { await api.activateChapter(id); await loadChapters(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function complete(id) {
    setBusy(true); setErr('');
    try { await api.completeChapter(id); await loadChapters(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function deleteChapter(id) {
    setBusy(true); setErr('');
    try { await api.deleteChapter(id); await loadChapters(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const activeChapter = chapters.find((c) => c.status === 'active');
  const proposedChapter = chapters.find((c) => c.status === 'proposed');

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Story Arc</h2>

      {/* Episode goal */}
      <div style={{ marginBottom: 20, padding: 12, background: '#141414', borderRadius: 6, border: '1px solid #222' }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Episode Goal (final destination)</div>
        {episode?.goal && !editingGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{episode.goal}</span>
            <button onClick={() => { setGoalDraft(episode.goal); setEditingGoal(true); }} style={ghostBtn}>edit</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={editingGoal ? goalDraft : goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              placeholder="e.g. Beverly must choose whether to seal the Whispering Heart or free what's inside"
              rows={2}
              style={textareaStyle}
            />
            <button onClick={saveGoal} disabled={busy || !goalDraft.trim()} style={btn}>
              {busy ? 'Saving…' : 'Set'}
            </button>
            {editingGoal && <button onClick={() => setEditingGoal(false)} style={ghostBtn}>cancel</button>}
          </div>
        )}
      </div>

      {/* Chapter list */}
      {chapters.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {chapters.map((ch) => (
            <div key={ch.id} style={{ ...row, borderLeftColor: statusColor[ch.status] || '#333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: statusColor[ch.status], textTransform: 'uppercase', fontWeight: 600 }}>
                  {ch.status}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Ch {ch.sequence}: {ch.title}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>{ch.goal}</div>
              {ch.summary && (
                <div style={{ fontSize: 12, opacity: 0.5, fontStyle: 'italic' }}>Result: {ch.summary}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {ch.status === 'proposed' && (
                  <>
                    <button onClick={() => activate(ch.id)} disabled={busy} style={btn}>
                      {busy ? '…' : 'Activate'}
                    </button>
                    <button onClick={() => deleteChapter(ch.id)} disabled={busy} style={ghostBtn}>
                      Reject
                    </button>
                  </>
                )}
                {ch.status === 'active' && (
                  <button onClick={() => complete(ch.id)} disabled={busy} style={{ ...btn, background: '#2d3748' }}>
                    {busy ? '…' : 'Complete Chapter'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Propose next chapter */}
      {!proposedChapter && episode?.goal && (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={steering}
            onChange={(e) => setSteering(e.target.value)}
            placeholder="Optional: steer the next chapter (e.g. 'introduce a betrayal', 'focus on Wiley')"
            rows={2}
            style={textareaStyle}
          />
          <button onClick={propose} disabled={busy} style={{ ...btn, marginTop: 8 }}>
            {busy ? 'Claude is thinking…' : `Propose Chapter ${chapters.length + 1}`}
          </button>
        </div>
      )}

      {!episode?.goal && (
        <p style={{ opacity: 0.5, fontSize: 13 }}>Set an episode goal above to start proposing chapters.</p>
      )}

      {err && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</p>}
    </div>
  );
}

const btn = {
  padding: '8px 14px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
};
const ghostBtn = {
  padding: '4px 10px', background: 'transparent', color: '#888',
  border: '1px solid #444', borderRadius: 4, fontSize: 12, cursor: 'pointer',
};
const row = {
  padding: 12, borderRadius: 6, marginBottom: 8, background: '#141414',
  borderLeft: '3px solid #333',
};
const textareaStyle = {
  flex: 1, padding: 10, fontSize: 14, fontFamily: 'inherit',
  background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6,
  width: '100%', boxSizing: 'border-box',
};
