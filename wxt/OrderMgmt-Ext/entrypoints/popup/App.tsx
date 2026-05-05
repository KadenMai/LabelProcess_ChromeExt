import { useCallback, useEffect, useState } from 'react';
import './App.css';

type StatusType = 'success' | 'error' | 'info';

function isValidApiKey(apiKey: string): boolean {
  return apiKey.startsWith('Vqt/') && apiKey.length > 20;
}

async function testApiConnection(apiKey: string): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testVeeqoApi',
      apiKey,
    });
    if (response && response.success) return true;
    throw new Error((response as { error?: string })?.error || 'Unknown error');
  } catch (e) {
    console.error('API test failed:', e);
    return false;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'settings' | 'instructions'>('settings');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyType, setApiKeyType] = useState<'password' | 'text'>('password');
  const [uspsButtonColumn, setUspsButtonColumn] = useState(3);
  const [printNoteColumn, setPrintNoteColumn] = useState(6);
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

  const showStatus = useCallback((message: string, type: StatusType) => {
    setStatus({ show: true, type, message });
    setTimeout(() => setStatus((s) => ({ ...s, show: false })), 5000);
  }, []);

  const updateApiStatus = useCallback((isConnected: boolean, text: string) => {
    setApiStatus({ show: true, ok: isConnected, text });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.sync.get(['veeqoApiKey', 'uspsButtonColumn', 'printNoteColumn']);
        if (result.veeqoApiKey) {
          setApiKey(result.veeqoApiKey);
          const isValid = await testApiConnection(result.veeqoApiKey);
          updateApiStatus(isValid, isValid ? 'Connected to Veeqo API' : 'Connection failed');
        }
        if (result.uspsButtonColumn) setUspsButtonColumn(Number(result.uspsButtonColumn));
        if (result.printNoteColumn) setPrintNoteColumn(Number(result.printNoteColumn));
      } catch (e) {
        console.error('Error loading settings:', e);
        showStatus('Error loading settings', 'error');
      }
    })();
  }, [showStatus, updateApiStatus]);

  const onTestConnection = async () => {
    const k = apiKey.trim();
    if (!k) {
      showStatus('Please enter your API key first', 'error');
      return;
    }
    if (!isValidApiKey(k)) {
      showStatus('Invalid API key format. Veeqo API keys should start with "Vqt/"', 'error');
      return;
    }
    showStatus('Testing connection...', 'info');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testVeeqoApi', apiKey: k });
      if (response && response.success) {
        showStatus('Connection successful! API key is valid.', 'success');
        updateApiStatus(true, 'Connected to Veeqo API');
      } else {
        const err = (response as { error?: string })?.error || 'Unknown error';
        showStatus(`Connection failed: ${err}`, 'error');
        updateApiStatus(false, 'Connection failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showStatus('Error testing connection: ' + msg, 'error');
      updateApiStatus(false, 'Connection error');
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
    if (uspsButtonColumn < 1 || uspsButtonColumn > 20) {
      showStatus('USPS Button Column must be between 1 and 20', 'error');
      return;
    }
    if (printNoteColumn < 1 || printNoteColumn > 20) {
      showStatus('Print Note Column must be between 1 and 20', 'error');
      return;
    }
    try {
      await chrome.storage.sync.set({
        veeqoApiKey: k,
        uspsButtonColumn,
        printNoteColumn,
      });
      const ok = await testApiConnection(k);
      if (ok) {
        showStatus('Settings saved successfully! API connection verified.', 'success');
        updateApiStatus(true, 'Connected to Veeqo API');
      } else {
        showStatus('Settings saved, but API connection failed. Please check your key.', 'error');
        updateApiStatus(false, 'Connection failed');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      showStatus('Error saving settings', 'error');
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🚀 Veeqo USPS Extension</h1>
        <p>Configure your Veeqo USPS integration</p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={'tab' + (activeTab === 'settings' ? ' active' : '')}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          type="button"
          className={'tab' + (activeTab === 'instructions' ? ' active' : '')}
          onClick={() => setActiveTab('instructions')}
        >
          Instructions
        </button>
      </div>

      <div className={'tab-content' + (activeTab === 'settings' ? ' active' : '')} id="settings">
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">Veeqo API Key</label>
            <div className="input-wrapper">
              <input
                id="apiKey"
                type={apiKeyType}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Veeqo API key"
                autoComplete="off"
              />
              <button
                type="button"
                className="toggle-password"
                aria-label={apiKeyType === 'password' ? 'Show password' : 'Hide password'}
                onClick={() => setApiKeyType((t) => (t === 'password' ? 'text' : 'password'))}
              >
                {apiKeyType === 'password' ? '👁️' : '🙈'}
              </button>
            </div>
            <div className="help-text">
              Get your API key from Veeqo Settings → API Keys. This allows the extension to fetch order
              details.
            </div>
          </div>

          <div className="form-group">
            <div className="setting-row">
              <label htmlFor="uspsButtonColumn">USPS Button Column:</label>
              <input
                id="uspsButtonColumn"
                type="number"
                min={1}
                max={20}
                value={uspsButtonColumn}
                onChange={(e) => setUspsButtonColumn(parseInt(e.target.value, 10) || 3)}
              />
            </div>
            <div className="help-text">Column number where the USPS button will be added (default: 3)</div>
          </div>

          <div className="form-group">
            <div className="setting-row">
              <label htmlFor="printNoteColumn">Print Note Column:</label>
              <input
                id="printNoteColumn"
                type="number"
                min={1}
                max={20}
                value={printNoteColumn}
                onChange={(e) => setPrintNoteColumn(parseInt(e.target.value, 10) || 6)}
              />
            </div>
            <div className="help-text">Column number where the Print Note button will be added (default: 6)</div>
          </div>

          <div className="form-group">
            <div
              className={
                'api-status' + (apiStatus.show ? ' visible' : '') + (apiStatus.show ? (apiStatus.ok ? ' connected' : ' disconnected') : '')
              }
            >
              <div className={'status-indicator' + (apiStatus.ok ? ' connected' : ' disconnected')} />
              <span>{apiStatus.text}</span>
            </div>
          </div>

          <div className="button-group">
            <button type="button" className="btn-secondary" onClick={onTestConnection}>
              Test Connection
            </button>
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
          </div>
        </form>

        <div className={'status' + (status.show ? ' visible' : '') + (status.type ? ' ' + status.type : '')}>
          {status.message}
        </div>
      </div>

      <div className={'tab-content' + (activeTab === 'instructions' ? ' active' : '')} id="instructions">
        <div className="instruction-item">
          <h4>📋 How to Use</h4>
          <p>
            1. Go to your Veeqo allocations page
            <br />
            2. Click &quot;Fill Order Data&quot; to load order information
            <br />
            3. Click any &quot;USPS&quot; button to auto-fill shipping labels
            <br />
            4. Review and generate your USPS labels
          </p>
        </div>
        <div className="instruction-item">
          <h4>⚙️ Configuration</h4>
          <p>
            • <strong>API Key:</strong> Required for fetching order details from Veeqo
            <br />
            • <strong>USPS Button Column:</strong> Choose which column to add the USPS button (default: 3)
            <br />• <strong>Test Connection:</strong> Verify your API key is working correctly
          </p>
        </div>
        <div className="instruction-item">
          <h4>🔧 Troubleshooting</h4>
          <p>
            • If buttons don&apos;t appear, refresh the Veeqo page
            <br />
            • If auto-fill doesn&apos;t work, check that the USPS page is fully loaded
            <br />
            • If API connection fails, verify your API key is correct
          </p>
        </div>
        <div className="instruction-item">
          <h4>📞 Support</h4>
          <p>
            For issues or questions, check the console logs for detailed error messages and troubleshooting
            information.
          </p>
        </div>
      </div>
    </div>
  );
}
