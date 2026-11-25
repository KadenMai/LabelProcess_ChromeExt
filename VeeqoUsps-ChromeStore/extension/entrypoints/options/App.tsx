import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_AUTH_WORKER_URL,
  getStoredAccessToken,
} from '../../utils/authConfig';
import {
  type AuthStatus,
  disconnectVeeqo,
  fetchAuthStatus,
  openConnectVeeqoTab,
  saveWorkerUrl,
  signOutGoogle,
  syncVeeqoAccessToken,
} from '../../utils/workerAuth';
import './App.css';

type StatusType = 'success' | 'error' | 'info';

async function testVeeqoApiMessage(accessToken: string): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testVeeqoApi',
      apiKey: accessToken,
    });
    if (response && (response as { success?: boolean }).success) return true;
    throw new Error((response as { error?: string })?.error || 'Unknown error');
  } catch (e) {
    console.error('API test failed:', e);
    return false;
  }
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [workerUrlInput, setWorkerUrlInput] = useState(DEFAULT_AUTH_WORKER_URL);
  const [apiStatus, setApiStatus] = useState<{ show: boolean; ok: boolean; text: string }>({
    show: false,
    ok: false,
    text: '',
  });
  const [status, setStatus] = useState<{ show: boolean; type: StatusType; message: string }>({
    show: false,
    type: 'info',
    message: '',
  });
  const [stats, setStats] = useState({ buttonsAdded: 0, apiCalls: 0, ordersFetched: 0 });

  const showStatus = useCallback((message: string, type: StatusType) => {
    setStatus({ show: true, type, message });
    setTimeout(() => setStatus((s) => ({ ...s, show: false })), 5000);
  }, []);

  const updateApiStatus = useCallback((isConnected: boolean, text: string) => {
    setApiStatus({ show: true, ok: isConnected, text });
  }, []);

  const loadStatistics = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['buttonsAdded', 'apiCalls', 'ordersFetched']);
      setStats({
        buttonsAdded: result.buttonsAdded ?? 0,
        apiCalls: result.apiCalls ?? 0,
        ordersFetched: result.ordersFetched ?? 0,
      });
    } catch (e) {
      console.error('Error loading statistics:', e);
    }
  }, []);

  const refreshAuth = useCallback(
    async (interactive = false) => {
      const result = await fetchAuthStatus(interactive);
      setAuth(result);
      setWorkerUrlInput(result.workerUrl);
      if (result.veeqoConnected) {
        try {
          const token = await syncVeeqoAccessToken(false);
          if (token) {
            const ok = await testVeeqoApiMessage(token);
            updateApiStatus(ok, ok ? 'Connected to Veeqo' : 'Veeqo token invalid');
          }
        } catch {
          updateApiStatus(false, 'Could not sync Veeqo token');
        }
      } else if (result.googleSignedIn && result.allowed) {
        updateApiStatus(false, 'Signed in — connect Veeqo');
      } else {
        updateApiStatus(false, result.error || 'Sign in with Google');
      }
      return result;
    },
    [updateApiStatus]
  );

  useEffect(() => {
    (async () => {
      try {
        await refreshAuth(false);
        await loadStatistics();
      } catch (e) {
        console.error('Error loading settings:', e);
        showStatus('Error loading settings', 'error');
      }
    })();
  }, [loadStatistics, showStatus, refreshAuth]);

  const onGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      await saveWorkerUrl(workerUrlInput);
      const result = await refreshAuth(true);
      showStatus(
        result.allowed ? `Signed in as ${result.email}` : result.error || 'Not allowlisted',
        result.allowed ? 'success' : 'error'
      );
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onConnectVeeqo = async () => {
    setAuthBusy(true);
    try {
      await saveWorkerUrl(workerUrlInput);
      await openConnectVeeqoTab();
      showStatus('Finish Connect Veeqo in the new tab, then Refresh.', 'info');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onRefresh = async () => {
    setAuthBusy(true);
    try {
      await saveWorkerUrl(workerUrlInput);
      const result = await refreshAuth(false);
      showStatus(
        result.veeqoConnected ? 'Veeqo connected.' : result.error || 'Status refreshed.',
        result.veeqoConnected ? 'success' : 'info'
      );
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onTest = async () => {
    showStatus('Testing connection...', 'info');
    let token = await getStoredAccessToken();
    if (!token) {
      try {
        token = await syncVeeqoAccessToken(false);
      } catch {
        /* ignore */
      }
    }
    if (!token) {
      showStatus('Connect Veeqo first', 'error');
      return;
    }
    const ok = await testVeeqoApiMessage(token);
    if (ok) {
      showStatus('Connection successful.', 'success');
      updateApiStatus(true, 'Connected to Veeqo');
    } else {
      showStatus('Connection failed.', 'error');
      updateApiStatus(false, 'Connection failed');
    }
  };

  const onDisconnect = async () => {
    if (!confirm('Disconnect Veeqo for this Google account?')) return;
    try {
      await disconnectVeeqo();
      await refreshAuth(false);
      showStatus('Veeqo disconnected.', 'success');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const onSignOut = async () => {
    await signOutGoogle();
    setAuth(null);
    updateApiStatus(false, 'Signed out');
    showStatus('Signed out.', 'success');
  };

  const onSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveWorkerUrl(workerUrlInput);
    showStatus('Worker URL saved.', 'success');
  };

  const version = chrome.runtime.getManifest().version;

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>Veeqo USPS Extension</h1>
        <p>Chrome Store — Google allowlist + Veeqo OAuth</p>
      </div>

      <div className="options-content">
        <div className="section">
          <h2>Account &amp; Veeqo</h2>
          <div className="instructions">
            <ol>
              <li>Set the Cloudflare Auth Worker URL below</li>
              <li>Sign in with an allowlisted Google account</li>
              <li>Click Connect Veeqo and approve access</li>
              <li>Refresh status to sync the Bearer token</li>
            </ol>
          </div>

          <form onSubmit={onSaveWorker}>
            <div className="form-group">
              <label htmlFor="opt-worker">Auth Worker URL</label>
              <input
                id="opt-worker"
                type="url"
                value={workerUrlInput}
                onChange={(e) => setWorkerUrlInput(e.target.value)}
                placeholder={DEFAULT_AUTH_WORKER_URL}
                autoComplete="off"
              />
            </div>

            <p className="help-text">
              {auth?.googleSignedIn
                ? `Google: ${auth.email}${auth.veeqoConnected ? ' · Veeqo connected' : ' · Veeqo not connected'}`
                : 'Not signed in'}
            </p>

            <div className="form-group">
              <div
                className={
                  'api-status' +
                  (apiStatus.show ? ' visible' : '') +
                  (apiStatus.show ? (apiStatus.ok ? ' connected' : ' disconnected') : '')
                }
              >
                <div
                  className={'status-indicator' + (apiStatus.ok ? ' connected' : ' disconnected')}
                />
                <span>{apiStatus.text}</span>
              </div>
            </div>

            <div className="button-group">
              {!auth?.googleSignedIn ? (
                <button type="button" className="btn-primary" disabled={authBusy} onClick={onGoogleSignIn}>
                  Sign in with Google
                </button>
              ) : (
                <>
                  {!auth.veeqoConnected && (
                    <button type="button" className="btn-primary" disabled={authBusy} onClick={onConnectVeeqo}>
                      Connect Veeqo
                    </button>
                  )}
                  <button type="button" className="btn-secondary" disabled={authBusy} onClick={onRefresh}>
                    Refresh
                  </button>
                  <button type="button" className="btn-secondary" onClick={onTest}>
                    Test Veeqo API
                  </button>
                  {auth.veeqoConnected && (
                    <button type="button" className="btn-success" onClick={onDisconnect}>
                      Disconnect Veeqo
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={onSignOut}>
                    Sign out
                  </button>
                </>
              )}
              <button type="submit" className="btn-primary">
                Save Worker URL
              </button>
            </div>
          </form>

          <div className={'status' + (status.show ? ' visible' : '') + (status.type ? ' ' + status.type : '')}>
            {status.message}
          </div>
        </div>

        <div className="section">
          <h2>Extension Statistics</h2>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-number">{stats.buttonsAdded}</div>
              <div className="stat-label">USPS Buttons Added</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.apiCalls}</div>
              <div className="stat-label">API Calls Made</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.ordersFetched}</div>
              <div className="stat-label">Orders Fetched</div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>About</h2>
          <p>
            Chrome Store build of the Veeqo USPS Label Manager. Uses Google sign-in (allowlisted
            Gmail) and Veeqo OAuth via a Cloudflare Worker — no per-user API keys.
          </p>
          <p>
            <strong>Version:</strong> {version}
          </p>
        </div>
      </div>
    </div>
  );
}
