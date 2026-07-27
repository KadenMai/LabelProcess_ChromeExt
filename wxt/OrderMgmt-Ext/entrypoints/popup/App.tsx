import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

type StatusType = 'success' | 'error' | 'info';
type TabId = 'settings' | 'labels' | 'instructions';

type DailyLabelsProgress = {
  phase: 'fetching_orders' | 'downloading_labels' | 'merging' | 'done';
  message: string;
  page?: number;
  found?: number;
  batch?: number;
  totalBatches?: number;
};

type GeneratedPdf = {
  dateStr: string;
  shipmentCount: number;
  filename: string;
  pdfBase64: string;
};

function isValidApiKey(apiKey: string): boolean {
  return apiKey.startsWith('Vqt/') && apiKey.length > 20;
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DEFAULT_SHARE_MESSAGE = '[GocBepViet] Shipping Label';

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Combine stored share message with the label date (used as email subject, etc.). */
function buildShareSubject(shareMessage: string, dateStr: string): string {
  const base = shareMessage.trim() || DEFAULT_SHARE_MESSAGE;
  return `${base} ${dateStr}`.trim();
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
  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyType, setApiKeyType] = useState<'password' | 'text'>('password');
  const [uspsButtonColumn, setUspsButtonColumn] = useState(3);
  const [printNoteColumn, setPrintNoteColumn] = useState(4);
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

  const [labelDate, setLabelDate] = useState(todayLocalYmd);
  const [shareMessage, setShareMessage] = useState(DEFAULT_SHARE_MESSAGE);
  const [shareMessageReady, setShareMessageReady] = useState(false);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsProgress, setLabelsProgress] = useState<DailyLabelsProgress | null>(null);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdf | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

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
        const result = await chrome.storage.sync.get([
          'veeqoApiKey',
          'uspsButtonColumn',
          'printNoteColumn',
          'labelsShareMessage',
        ]);
        if (result.veeqoApiKey) {
          setApiKey(result.veeqoApiKey);
          const isValid = await testApiConnection(result.veeqoApiKey);
          updateApiStatus(isValid, isValid ? 'Connected to Veeqo API' : 'Connection failed');
        }
        if (result.uspsButtonColumn) setUspsButtonColumn(Number(result.uspsButtonColumn));
        if (result.printNoteColumn) setPrintNoteColumn(Number(result.printNoteColumn));
        if (typeof result.labelsShareMessage === 'string' && result.labelsShareMessage.trim()) {
          setShareMessage(result.labelsShareMessage);
        }
        setShareMessageReady(true);
      } catch (e) {
        console.error('Error loading settings:', e);
        showStatus('Error loading settings', 'error');
        setShareMessageReady(true);
      }
    })();
  }, [showStatus, updateApiStatus]);

  useEffect(() => {
    if (!shareMessageReady) return;
    const timer = setTimeout(() => {
      const value = shareMessage.trim() || DEFAULT_SHARE_MESSAGE;
      chrome.storage.sync.set({ labelsShareMessage: value }).catch((e) => {
        console.error('Error saving share message:', e);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [shareMessage, shareMessageReady]);

  useEffect(() => {
    const onMessage = (msg: { action?: string; progress?: DailyLabelsProgress }) => {
      if (msg?.action === 'dailyLabelsProgress' && msg.progress) {
        setLabelsProgress(msg.progress);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

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

  const onGenerateLabels = async () => {
    setLabelsError(null);
    setShareNote(null);
    setGeneratedPdf(null);
    setLabelsLoading(true);
    setLabelsProgress({ phase: 'fetching_orders', message: 'Starting…' });

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateDailyLabelsPdf',
        apiKey: apiKey.trim() || undefined,
        targetDate: labelDate || todayLocalYmd(),
      });

      if (!response?.success || !response.data) {
        throw new Error(response?.error || 'Failed to generate labels PDF');
      }

      const data = response.data as {
        dateStr: string;
        shipmentIds: number[];
        filename: string;
        pdfBase64: string;
      };

      setGeneratedPdf({
        dateStr: data.dateStr,
        shipmentCount: data.shipmentIds.length,
        filename: data.filename,
        pdfBase64: data.pdfBase64,
      });
      setLabelsProgress({
        phase: 'done',
        message: `Ready — ${data.shipmentIds.length} UPS label(s) for ${data.dateStr}`,
        found: data.shipmentIds.length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLabelsError(msg);
      setLabelsProgress(null);
    } finally {
      setLabelsLoading(false);
    }
  };

  const onDownloadPdf = async () => {
    if (!generatedPdf) return false;
    setShareNote(null);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadDailyLabelsPdf',
        pdfBase64: generatedPdf.pdfBase64,
        filename: generatedPdf.filename,
      });
      if (response?.success) {
        setShareNote('Download started — choose where to save the PDF.');
        return true;
      }

      // Fallback if data-URL download is too large for chrome.downloads
      const blob = base64ToBlob(generatedPdf.pdfBase64, 'application/pdf');
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = generatedPdf.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setShareNote('Download started.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLabelsError(msg);
      return false;
    }
  };

  const canWebShareFiles = useMemo(() => {
    try {
      return typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share;
    } catch {
      return false;
    }
  }, []);

  const shareSubjectPreview = useMemo(
    () => buildShareSubject(shareMessage, generatedPdf?.dateStr || labelDate || todayLocalYmd()),
    [shareMessage, generatedPdf?.dateStr, labelDate]
  );

  const onShareNative = async () => {
    if (!generatedPdf) return;
    setShareNote(null);
    try {
      const subject = buildShareSubject(shareMessage, generatedPdf.dateStr);
      const file = new File(
        [base64ToBlob(generatedPdf.pdfBase64, 'application/pdf')],
        generatedPdf.filename,
        { type: 'application/pdf' }
      );
      if (!navigator.canShare?.({ files: [file] })) {
        setShareNote(
          'This browser cannot attach PDFs via Share. Download the file, then attach it in Email or WhatsApp.'
        );
        return;
      }
      await navigator.share({
        files: [file],
        title: subject,
        text: `${subject}\n${generatedPdf.shipmentCount} label(s). Please attach: ${generatedPdf.filename}`,
      });
      setShareNote('Shared successfully.');
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'AbortError') return;
      setShareNote(err.message || 'Share cancelled or failed.');
    }
  };

  const onShareEmail = async () => {
    if (!generatedPdf) return;
    setShareNote(null);
    const ok = await onDownloadPdf();
    if (!ok) return;
    const subject = encodeURIComponent(buildShareSubject(shareMessage, generatedPdf.dateStr));
    const body = encodeURIComponent(
      `Please find the UPS shipping labels PDF attached (${generatedPdf.filename}).\n\n` +
        `${generatedPdf.shipmentCount} label(s) purchased on ${generatedPdf.dateStr}.\n\n` +
        `(Attach the downloaded PDF file to this email.)`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShareNote('PDF download started. Attach that file in your email compose window.');
  };

  const onShareWhatsApp = async () => {
    if (!generatedPdf) return;
    setShareNote(null);
    const ok = await onDownloadPdf();
    if (!ok) return;
    const subject = buildShareSubject(shareMessage, generatedPdf.dateStr);
    const text = encodeURIComponent(
      `${subject}\n${generatedPdf.shipmentCount} label(s).\n` +
        `Please attach the downloaded file: ${generatedPdf.filename}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShareNote('PDF download started. Attach that file in the WhatsApp chat.');
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
          className={'tab' + (activeTab === 'labels' ? ' active' : '')}
          onClick={() => setActiveTab('labels')}
        >
          Labels
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
                onChange={(e) => setPrintNoteColumn(parseInt(e.target.value, 10) || 4)}
              />
            </div>
            <div className="help-text">Column number where the Print Note button will be added (default: 4 — Order column)</div>
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

      <div className={'tab-content' + (activeTab === 'labels' ? ' active' : '')} id="labels">
        <div className="labels-intro">
          <p>
            Generate a single PDF of all <strong>UPS</strong> shipping labels purchased on a local
            calendar day (same logic as the retrieve_label sample).
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="labelDate">Label date (local time)</label>
          <input
            id="labelDate"
            type="date"
            value={labelDate}
            onChange={(e) => setLabelDate(e.target.value)}
            disabled={labelsLoading}
          />
          <div className="help-text">Defaults to today. Uses your computer&apos;s local timezone.</div>
        </div>

        <div className="form-group">
          <label htmlFor="shareMessage">Share message</label>
          <input
            id="shareMessage"
            type="text"
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
            placeholder={DEFAULT_SHARE_MESSAGE}
            autoComplete="off"
          />
          <div className="help-text">
            Saved automatically. Email subject / WhatsApp text:{' '}
            <strong>{shareSubjectPreview}</strong>
          </div>
        </div>

        <div className="button-group">
          <button
            type="button"
            className="btn-primary"
            onClick={onGenerateLabels}
            disabled={labelsLoading}
          >
            {labelsLoading ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>

        {labelsProgress && (
          <div className="labels-progress">
            <div className="labels-progress-bar" data-phase={labelsProgress.phase} />
            <p>{labelsProgress.message}</p>
          </div>
        )}

        {labelsError && <div className="status error visible">{labelsError}</div>}

        {generatedPdf && !labelsLoading && (
          <div className="labels-result">
            <div className="labels-result-summary">
              <strong>{generatedPdf.filename}</strong>
              <span>
                {generatedPdf.shipmentCount} UPS label{generatedPdf.shipmentCount === 1 ? '' : 's'} ·{' '}
                {generatedPdf.dateStr}
              </span>
            </div>

            <div className="button-group labels-actions">
              <button type="button" className="btn-primary" onClick={onDownloadPdf}>
                Download
              </button>
              <button type="button" className="btn-secondary" onClick={onShareEmail}>
                Email
              </button>
              <button type="button" className="btn-secondary" onClick={onShareWhatsApp}>
                WhatsApp
              </button>
            </div>

            {canWebShareFiles && (
              <div className="button-group">
                <button type="button" className="btn-secondary" onClick={onShareNative}>
                  Share…
                </button>
              </div>
            )}

            <div className="help-text">
              Email and WhatsApp open a compose window after downloading — attach the saved PDF
              (browsers cannot attach files automatically).
            </div>
          </div>
        )}

        {shareNote && <div className="status info visible">{shareNote}</div>}
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
          <h4>📦 Daily UPS Labels</h4>
          <p>
            Open the <strong>Labels</strong> tab, pick a date (defaults to today), then Generate PDF.
            Download the merged file, or use Email / WhatsApp (attach the downloaded PDF in the
            compose window).
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
            <br />
            • If Labels PDF finds 0 shipments, confirm labels were bought that local day via UPS
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
