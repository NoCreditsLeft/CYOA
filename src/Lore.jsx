import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

export default function Lore() {
  const [chapters, setChapters] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    try { setChapters(await api.listChapters()); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  const completed = chapters.filter((c) => c.status === 'complete');

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ marginBottom: 8 }}>The Lore</h2>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: 0 }}>
        The committed story as shaped by the community.
      </p>

      {err && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</p>}

      {completed.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: 13 }}>No chapters committed to lore yet.</p>
      ) : (
        <div>
          {completed.map((ch) => (
            <div key={ch.id} style={chapterCard}>
              <div
                style={chapterHeader}
                onClick={() => setExpanded(expanded === ch.id ? null : ch.id)}
              >
                <div>
                  <span style={{ fontSize: 12, color: '#38a169', textTransform: 'uppercase', fontWeight: 600, marginRight: 8 }}>
                    Chapter {ch.sequence}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{ch.title}</span>
                </div>
                <span style={{ fontSize: 18, opacity: 0.5 }}>
                  {expanded === ch.id ? '▾' : '▸'}
                </span>
              </div>

              {ch.summary && (
                <div style={{ fontSize: 13, opacity: 0.7, padding: '0 12px 8px', fontStyle: 'italic' }}>
                  {ch.summary}
                </div>
              )}

              {expanded === ch.id && ch.lore_text && (
                <div style={loreBody}>
                  {ch.lore_text.split('\n\n---\n\n').map((section, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      {section.split('\n').map((line, j) => {
                        if (line.startsWith('> ')) {
                          return <p key={j} style={choiceLine}>{line.slice(2)}</p>;
                        }
                        return <p key={j} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{line}</p>;
                      })}
                      {i < ch.lore_text.split('\n\n---\n\n').length - 1 && (
                        <hr style={{ border: 'none', borderTop: '1px solid #222', margin: '16px 0' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {expanded === ch.id && !ch.lore_text && (
                <div style={{ padding: '8px 12px', fontSize: 13, opacity: 0.5 }}>
                  No narrative text committed for this chapter.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const chapterCard = {
  background: '#141414', border: '1px solid #222', borderRadius: 6,
  marginBottom: 12, overflow: 'hidden',
};
const chapterHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 12, cursor: 'pointer',
};
const loreBody = {
  padding: '0 12px 12px', fontSize: 14, color: '#d4d4d4',
  borderTop: '1px solid #222',
  paddingTop: 12,
};
const choiceLine = {
  margin: '0 0 8px', lineHeight: 1.6,
  paddingLeft: 12, borderLeft: '2px solid #d69e2e',
  color: '#d69e2e', fontStyle: 'italic', fontSize: 13,
};
