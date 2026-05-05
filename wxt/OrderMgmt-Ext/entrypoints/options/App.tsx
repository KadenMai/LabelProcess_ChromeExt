import { useCallback, useEffect, useState } from 'react';
import './App.css';

type StatusType = 'success' | 'error' | 'info';

function isValidApiKey(apiKey: string): boolean {
  return apiKey.startsWith('Vqt/') && apiKey.length > 20;
}

async function testVeeqoApiMessage(apiKey: string): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testVeeqoApi',
      apiKey,
    });
    if (response && (response as { success?: boolean }).success) return true;
    throw new Error((response as { error?: string })?.error || 'Unknown error');
  } catch (e) {
    console.error('API test failed:', e);
    return false;
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState('');
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

  const bumpStat = useCallback(
    async (key: 'buttonsAdded' | 'apiCalls' | 'ordersFetched', n = 1) => {
      try {
        const result = await chrome.storage.local.get([key]);
        const v = (result[key] as number) || 0;
        const newValue = v + n;
        await chrome.storage.local.set({ [key]: newValue });
        setStats((s) => ({ ...s, [key]: newValue }));
      } catch (e) {
        console.error('Error updating statistic:', e);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        if (result.veeqoApiKey) {
          setApiKey(result.veeqoApiKey);
          const isValid = await testVeeqoApiMessage(result.veeqoApiKey);
          updateApiStatus(isValid, isValid ? 'Connected to Veeqo API' : 'Connection failed');
        }
        await loadStatistics();
      } catch (e) {
        console.error('Error loading settings:', e);
        showStatus('Error loading settings', 'error');
      }
    })();
  }, [loadStatistics, showStatus, updateApiStatus]);

  const onTest = async () => {
    const k = apiKey.trim();
    if (!k) {
      showStatus('Please enter your API key first', 'error');
      return;
    }
    showStatus('Testing connection...', 'info');
    const ok = await testVeeqoApiMessage(k);
    if (ok) {
      showStatus('Connection successful! API key is valid.', 'success');
      updateApiStatus(true, 'Connected to Veeqo API');
      await bumpStat('apiCalls', 1);
    } else {
      showStatus('Connection failed. Please check your API key.', 'error');
      updateApiStatus(false, 'Connection failed');
    }
  };

  const onClear = async () => {
    if (
      !confirm('Are you sure you want to clear your API key? This will disable API functionality.')
    ) {
      return;
    }
    try {
      await chrome.storage.sync.remove(['veeqoApiKey']);
      setApiKey('');
      updateApiStatus(false, 'No API key configured');
      showStatus('API key cleared successfully', 'success');
    } catch (e) {
      console.error('Error clearing API key:', e);
      showStatus('Error clearing API key', 'error');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = apiKey.trim();
    if (!k) {
      showStatus('Please enter your Veeqo API key', 'error');
      return;
    }
    if (!isValidApiKey(k)) {
      showStatus('Invalid API key format. Please check your key.', 'error');
      return;
    }
    try {
      await chrome.storage.sync.set({ veeqoApiKey: k });
      const ok = await testVeeqoApiMessage(k);
      if (ok) {
        showStatus('Settings saved successfully! API connection verified.', 'success');
        updateApiStatus(true, 'Connected to Veeqo API');
        await bumpStat('apiCalls', 1);
      } else {
        showStatus('Settings saved, but API connection failed. Please check your key.', 'error');
        updateApiStatus(false, 'Connection failed');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      showStatus('Error saving settings', 'error');
    }
  };

  const version = chrome.runtime.getManifest().version;

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>🚀 Veeqo USPS Extension</h1>
        <p>Advanced Settings &amp; Configuration</p>
      </div>

      <div className="options-content">
        <div className="section">
          <h2>🔑 API Configuration</h2>
          <div className="instructions">
            <h3>How to get your Veeqo API Key:</h3>
            <ol>
              <li>Log into your Veeqo account</li>
              <li>Go to Settings → API Keys</li>
              <li>Create a new API key or use an existing one</li>
              <li>Copy the key and paste it below</li>
            </ol>
          </div>

          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="opt-apikey">Veeqo API Key</label>
              <input
                id="opt-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Veeqo API key"
                autoComplete="off"
              />
              <div className="help-text">
                Your API key allows the extension to fetch order details and enhance functionality. The
                key is stored securely in your browser and never shared.
              </div>
            </div>

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
              <button type="button" className="btn-secondary" onClick={onTest}>
                🧪 Test Connection
              </button>
              <button type="button" className="btn-success" onClick={onClear}>
                🗑️ Clear API Key
              </button>
              <button type="submit" className="btn-primary">
                💾 Save Settings
              </button>
            </div>
          </form>

          <div className={'status' + (status.show ? ' visible' : '') + (status.type ? ' ' + status.type : '')}>
            {status.message}
          </div>
        </div>

        <div className="section">
          <h2>📊 Extension Statistics</h2>
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
          <h2>ℹ️ About</h2>
          <p>
            This extension adds USPS buttons to your Veeqo allocations table for quick access to the USPS
            Label Manager.
          </p>
          <p>
            <strong>Version:</strong> {version}
          </p>
          <p>
            <strong>Features:</strong>
          </p>
          <ul className="about-list">
            <li>Automatic USPS button injection</li>
            <li>Order data integration (with API key)</li>
            <li>Persistent button placement</li>
            <li>Secure API key storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
