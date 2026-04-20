import { useEffect, useState } from 'react';
import { api, session } from './lib/api.js';
import Chapters from './Chapters.jsx';
import FontOfTruth from './FontOfTruth.jsx';
import Lore from './Lore.jsx';
import Pages from './Pages.jsx';
import StyleGuide from './StyleGuide.jsx';

const TABS = ['Create', 'Breadcrumbs', 'Lore'];

export default function App() {
  const [me, setMe] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [tab, setTab] = useState('Create');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session.get()) return;
    api.me().then(setMe).catch((e) => {
      session.clear();
      setStatus(`Session invalid: ${e.message}`);
    });
  }, []);

  async function signIn() {
    setBusy(true);
    setStatus('');
    try {
      if (!window.ethereum) throw new Error('No EVM wallet detected (install MetaMask etc.)');
      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const wallet = addr.toLowerCase();
      const message = [
        'CYOA Loremaster Console',
        `Wallet: ${wallet}`,
        `Timestamp: ${Date.now()}`,
      ].join('\n');
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      });
      const result = await api.verifySignature(wallet, message, signature);
      session.set(result.token);
      setMe({ wallet, role: result.role });
      setStatus('');
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    session.clear();
    setMe(null);
    setStatus('');
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>CYOA — Loremaster Console</h1>

      {!me ? (
        <div style={{ marginTop: 24 }}>
          <button onClick={signIn} disabled={busy} style={btn}>
            {busy ? 'Waiting for wallet…' : 'Sign in with Wallet'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ margin: 0 }}>
              Signed in as <code>{me.wallet}</code> — role: <strong>{me.role}</strong>
            </p>
            <button onClick={signOut} style={btnSmall}>Sign out</button>
          </div>

          {/* Tab bar */}
          <div style={tabBar}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={tab === t ? { ...tabBtn, ...tabBtnActive } : tabBtn}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'Create' && (
            <>
              <StyleGuide />
              <Chapters episode={episode} onEpisodeUpdate={setEpisode} />
              <Pages onEpisodeLoad={setEpisode} />
            </>
          )}

          {tab === 'Breadcrumbs' && <FontOfTruth />}

          {tab === 'Lore' && <Lore />}
        </div>
      )}

      {status && <p style={{ color: '#ff6b6b', marginTop: 16 }}>{status}</p>}
    </div>
  );
}

const btn = {
  padding: '10px 16px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
};
const btnSmall = {
  padding: '6px 12px', background: '#2b6cb0', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
};
const tabBar = {
  display: 'flex', gap: 0, borderBottom: '1px solid #333', marginBottom: 24,
};
const tabBtn = {
  padding: '10px 20px', background: 'transparent', color: '#888',
  border: 'none', borderBottom: '2px solid transparent',
  fontSize: 14, cursor: 'pointer', fontWeight: 500,
};
const tabBtnActive = {
  color: '#e8e8e8', borderBottomColor: '#2b6cb0',
};
