import { useEffect, useState } from 'react';
import { api, session } from './lib/api.js';
import Chapters from './Chapters.jsx';
import FontOfTruth from './FontOfTruth.jsx';
import Pages from './Pages.jsx';
import StyleGuide from './StyleGuide.jsx';

export default function App() {
  const [me, setMe] = useState(null);       // { wallet, role } when signed in
  const [episode, setEpisode] = useState(null); // active episode
  const [status, setStatus] = useState(''); // status / error text
  const [busy, setBusy] = useState(false);

  // On load, if we have a token, verify it.
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
          <p>
            Signed in as <code>{me.wallet}</code> — role: <strong>{me.role}</strong>
          </p>
          <button onClick={signOut} style={btn}>Sign out</button>

          <StyleGuide />
          <Chapters episode={episode} onEpisodeUpdate={setEpisode} />
          <FontOfTruth />
          <Pages onEpisodeLoad={setEpisode} />
        </div>
      )}

      {status && <p style={{ color: '#ff6b6b', marginTop: 16 }}>{status}</p>}
    </div>
  );
}

const btn = {
  padding: '10px 16px',
  background: '#2b6cb0',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
};
