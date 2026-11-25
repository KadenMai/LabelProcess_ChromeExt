import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** SKU -> Item Name -> Link record used to personalize the printed Thank-You card / QR code. */
type SkuRecord = {
  sku: string;
  itemName: string;
  link: string;
};

const SKU_RECORDS_STORAGE_KEY = 'thankYouSkuRecords';

function normalizeLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Merge `incoming` records into `existing`, keyed by SKU (case-insensitive). Existing records keep
 * their position when updated; the last record for a given SKU — whether already present or later
 * in `incoming` — wins.
 */
function mergeSkuRecords(existing: SkuRecord[], incoming: SkuRecord[]): SkuRecord[] {
  const map = new Map<string, SkuRecord>();
  for (const record of existing) {
    map.set(record.sku.trim().toLowerCase(), record);
  }
  for (const record of incoming) {
    const key = record.sku.trim().toLowerCase();
    if (key) map.set(key, record);
  }
  return Array.from(map.values());
}

/** Raw shape expected in an imported JSON SKU-records file. */
type ImportedSkuRecord = { sku?: unknown; item?: unknown; link?: unknown };

/**
 * Parse + validate an imported JSON file's contents into SkuRecord[], skipping invalid entries.
 * @returns the valid records and a count of entries that were skipped
 */
function parseImportedSkuRecords(json: unknown): { records: SkuRecord[]; skipped: number } {
  if (!Array.isArray(json)) {
    throw new Error('JSON file must contain an array of records.');
  }
  const records: SkuRecord[] = [];
  let skipped = 0;
  for (const entry of json as ImportedSkuRecord[]) {
    const sku = typeof entry?.sku === 'string' ? entry.sku.trim() : '';
    const link = typeof entry?.link === 'string' ? normalizeLink(entry.link) : '';
    const itemName = typeof entry?.item === 'string' ? entry.item.trim() : '';
    if (!sku || !link) {
      skipped++;
      continue;
    }
    records.push({ sku, itemName, link });
  }
  return { records, skipped };
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

/** Same PDF filename for Download / Email attachment / Share / WhatsApp. */
function buildPdfFileName(shareMessage: string, dateStr: string): string {
  return `${sanitizeFileName(buildShareSubject(shareMessage, dateStr))}.pdf`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'UPS_Labels';
}

function encodeRfc2047Subject(text: string): string {
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function foldBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

/**
 * Build a .eml draft with subject + PDF attachment.
 * X-Unsent: 1 tells Outlook/Thunderbird to open it as a new outbound
 * compose window (send to someone), not as a received message.
 */
function buildEmailDraftEml(opts: {
  subject: string;
  body: string;
  pdfFileName: string;
  pdfBase64: string;
}): Blob {
  const boundary = `----=_Part_${Date.now()}`;
  const safeAttachName = sanitizeFileName(opts.pdfFileName);
  const eml =
    `X-Unsent: 1\r\n` +
    `From: \r\n` +
    `To: \r\n` +
    `Subject: ${encodeRfc2047Subject(opts.subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: 8bit\r\n` +
    `\r\n` +
    `${opts.body}\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf; name="${safeAttachName}"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-Disposition: attachment; filename="${safeAttachName}"\r\n` +
    `\r\n` +
    `${foldBase64(opts.pdfBase64)}\r\n` +
    `--${boundary}--\r\n`;

  return new Blob([eml], { type: 'message/rfc822' });
}

/** Download to the default Downloads folder (no Save As) and open with the OS default app. */
async function downloadAndOpenFile(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const downloadId = await chrome.downloads.download({
      url: objectUrl,
      filename,
      saveAs: false,
      conflictAction: 'uniquify',
    });

    await new Promise<void>((resolve, reject) => {
      const finish = (err?: string) => {
        chrome.downloads.onChanged.removeListener(onChanged);
        if (err) reject(new Error(err));
        else resolve();
      };

      const onChanged = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id !== downloadId) return;
        if (delta.state?.current === 'complete') finish();
        else if (delta.state?.current === 'interrupted') {
          finish(delta.error?.current || 'Download was interrupted');
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);

      chrome.downloads.search({ id: downloadId }).then((items) => {
        const item = items[0];
        if (!item) return;
        if (item.state === 'complete') finish();
        else if (item.state === 'interrupted') finish(item.error || 'Download was interrupted');
      });
    });

    await chrome.downloads.open(downloadId);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
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
  const [activeTab, setActiveTab] = useState<TabId>('labels');
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [workerUrlInput, setWorkerUrlInput] = useState(DEFAULT_AUTH_WORKER_URL);
  const [uspsButtonColumn, setUspsButtonColumn] = useState(3);
  const [printNoteColumn, setPrintNoteColumn] = useState(4);
  const [thankButtonColumn, setThankButtonColumn] = useState(4);
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
  const [addTimestamp, setAddTimestamp] = useState(true);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsProgress, setLabelsProgress] = useState<DailyLabelsProgress | null>(null);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdf | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const [skuRecords, setSkuRecords] = useState<SkuRecord[]>([]);
  const [skuRecordsReady, setSkuRecordsReady] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [skuRecordsError, setSkuRecordsError] = useState<string | null>(null);
  const [skuRecordsNote, setSkuRecordsNote] = useState<string | null>(null);
  const skuImportInputRef = useRef<HTMLInputElement>(null);

  const showStatus = useCallback((message: string, type: StatusType) => {
    setStatus({ show: true, type, message });
    setTimeout(() => setStatus((s) => ({ ...s, show: false })), 5000);
  }, []);

  const updateApiStatus = useCallback((isConnected: boolean, text: string) => {
    setApiStatus({ show: true, ok: isConnected, text });
  }, []);

  const refreshAuth = useCallback(
    async (interactive = false) => {
      const statusResult = await fetchAuthStatus(interactive);
      setAuth(statusResult);
      setWorkerUrlInput(statusResult.workerUrl);
      if (statusResult.veeqoConnected) {
        try {
          const token = await syncVeeqoAccessToken(false);
          if (token) {
            const ok = await testApiConnection(token);
            updateApiStatus(ok, ok ? 'Connected to Veeqo' : 'Veeqo token invalid');
          } else {
            updateApiStatus(false, 'Connect Veeqo to continue');
          }
        } catch {
          updateApiStatus(false, 'Could not sync Veeqo token');
        }
      } else if (statusResult.googleSignedIn && statusResult.allowed) {
        updateApiStatus(false, 'Signed in — connect Veeqo');
      } else if (statusResult.error) {
        updateApiStatus(false, statusResult.error);
      } else {
        updateApiStatus(false, 'Sign in with Google');
      }
      return statusResult;
    },
    [updateApiStatus]
  );

  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.sync.get([
          'uspsButtonColumn',
          'printNoteColumn',
          'thankButtonColumn',
          'labelsShareMessage',
          'labelsAddTimestamp',
          'authWorkerUrl',
        ]);
        if (result.uspsButtonColumn) setUspsButtonColumn(Number(result.uspsButtonColumn));
        if (result.printNoteColumn) setPrintNoteColumn(Number(result.printNoteColumn));
        if (result.thankButtonColumn) setThankButtonColumn(Number(result.thankButtonColumn));
        if (typeof result.labelsShareMessage === 'string' && result.labelsShareMessage.trim()) {
          setShareMessage(result.labelsShareMessage);
        }
        if (typeof result.labelsAddTimestamp === 'boolean') {
          setAddTimestamp(result.labelsAddTimestamp);
        }
        if (typeof result.authWorkerUrl === 'string' && result.authWorkerUrl.trim()) {
          setWorkerUrlInput(result.authWorkerUrl);
        }
        setShareMessageReady(true);
        await refreshAuth(false);
      } catch (e) {
        console.error('Error loading settings:', e);
        showStatus('Error loading settings', 'error');
        setShareMessageReady(true);
      }
    })();
  }, [showStatus, refreshAuth]);

  useEffect(() => {
    if (!shareMessageReady) return;
    const timer = setTimeout(() => {
      const value = shareMessage.trim() || DEFAULT_SHARE_MESSAGE;
      chrome.storage.sync
        .set({ labelsShareMessage: value, labelsAddTimestamp: addTimestamp })
        .catch((e) => {
          console.error('Error saving label options:', e);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [shareMessage, addTimestamp, shareMessageReady]);

  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.local.get([SKU_RECORDS_STORAGE_KEY]);
        if (Array.isArray(result[SKU_RECORDS_STORAGE_KEY])) {
          setSkuRecords(result[SKU_RECORDS_STORAGE_KEY]);
        }
      } catch (e) {
        console.error('Error loading SKU records:', e);
      } finally {
        setSkuRecordsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!skuRecordsReady) return;
    const timer = setTimeout(() => {
      chrome.storage.local.set({ [SKU_RECORDS_STORAGE_KEY]: skuRecords }).catch((e) => {
        console.error('Error saving SKU records:', e);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [skuRecords, skuRecordsReady]);

  useEffect(() => {
    const onMessage = (msg: { action?: string; progress?: DailyLabelsProgress }) => {
      if (msg?.action === 'dailyLabelsProgress' && msg.progress) {
        setLabelsProgress(msg.progress);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const onGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      await saveWorkerUrl(workerUrlInput);
      const result = await refreshAuth(true);
      if (result.error && !result.allowed) {
        showStatus(result.error, 'error');
      } else if (result.googleSignedIn && result.allowed) {
        showStatus(`Signed in as ${result.email}`, 'success');
      } else {
        showStatus(result.error || 'Sign-in failed', 'error');
      }
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
      showStatus('Complete Connect Veeqo in the new tab, then click Refresh status.', 'info');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onRefreshAuth = async () => {
    setAuthBusy(true);
    try {
      await saveWorkerUrl(workerUrlInput);
      const result = await refreshAuth(false);
      if (result.veeqoConnected) {
        showStatus('Veeqo connected and token synced.', 'success');
      } else if (result.googleSignedIn) {
        showStatus('Signed in. Connect Veeqo to finish setup.', 'info');
      } else {
        showStatus(result.error || 'Not signed in', 'error');
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onDisconnectVeeqo = async () => {
    setAuthBusy(true);
    try {
      await disconnectVeeqo();
      await refreshAuth(false);
      showStatus('Veeqo disconnected for this Google account.', 'success');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onGoogleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOutGoogle();
      setAuth(null);
      updateApiStatus(false, 'Signed out');
      showStatus('Signed out of Google.', 'success');
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const onTestConnection = async () => {
    showStatus('Testing Veeqo connection...', 'info');
    try {
      let token = await getStoredAccessToken();
      if (!token) token = await syncVeeqoAccessToken(false);
      if (!token) {
        showStatus('Connect Veeqo first', 'error');
        updateApiStatus(false, 'Veeqo not connected');
        return;
      }
      const ok = await testApiConnection(token);
      if (ok) {
        showStatus('Veeqo API connection successful.', 'success');
        updateApiStatus(true, 'Connected to Veeqo');
      } else {
        showStatus('Veeqo API connection failed. Try Connect Veeqo again.', 'error');
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
    if (uspsButtonColumn < 1 || uspsButtonColumn > 20) {
      showStatus('USPS Button Column must be between 1 and 20', 'error');
      return;
    }
    if (printNoteColumn < 1 || printNoteColumn > 20) {
      showStatus('Print Note Column must be between 1 and 20', 'error');
      return;
    }
    if (thankButtonColumn < 1 || thankButtonColumn > 20) {
      showStatus('Thank Button Column must be between 1 and 20', 'error');
      return;
    }
    try {
      await saveWorkerUrl(workerUrlInput);
      await chrome.storage.sync.set({
        uspsButtonColumn,
        printNoteColumn,
        thankButtonColumn,
      });
      showStatus('Settings saved.', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      showStatus('Error saving settings', 'error');
    }
  };

  const onAddSkuRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setSkuRecordsError(null);

    const sku = newSku.trim();
    const link = normalizeLink(newLink);
    if (!sku) {
      setSkuRecordsError('SKU is required.');
      return;
    }
    if (!link) {
      setSkuRecordsError('Link is required.');
      return;
    }
    const isDuplicate = skuRecords.some((r) => r.sku.trim().toLowerCase() === sku.toLowerCase());
    if (isDuplicate) {
      setSkuRecordsError(`SKU "${sku}" already has a record. Edit or remove it below.`);
      return;
    }

    setSkuRecords((records) => [...records, { sku, itemName: newItemName.trim(), link }]);
    setNewSku('');
    setNewItemName('');
    setNewLink('');
  };

  const onUpdateSkuRecordField = (index: number, field: keyof SkuRecord, value: string) => {
    setSkuRecords((records) =>
      records.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const onRemoveSkuRecord = (index: number) => {
    setSkuRecords((records) => records.filter((_, i) => i !== index));
  };

  const onImportSkuRecordsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setSkuRecordsError(null);
    setSkuRecordsNote(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { records: incoming, skipped } = parseImportedSkuRecords(json);

      if (incoming.length === 0) {
        setSkuRecordsError('No valid records found in that file (each entry needs "sku" and "link").');
        return;
      }

      setSkuRecords((records) => mergeSkuRecords(records, incoming));
      setSkuRecordsNote(
        `Imported ${incoming.length} record${incoming.length === 1 ? '' : 's'}` +
          (skipped > 0 ? ` — ${skipped} skipped (missing sku/link).` : '.')
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSkuRecordsError(`Could not import file: ${msg}`);
    }
  };

  const onExportSkuRecords = () => {
    setSkuRecordsError(null);

    if (skuRecords.length === 0) {
      setSkuRecordsNote('No records to export yet — add or import some first.');
      return;
    }

    const payload = skuRecords.map((r) => ({ sku: r.sku, item: r.itemName, link: r.link }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `gocbepviet-sku-records-${todayLocalYmd()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

    setSkuRecordsNote(`Exported ${skuRecords.length} record${skuRecords.length === 1 ? '' : 's'}.`);
  };

  const onGenerateLabels = async () => {
    setLabelsError(null);
    setShareNote(null);
    setGeneratedPdf(null);
    setLabelsLoading(true);
    setLabelsProgress({ phase: 'fetching_orders', message: 'Starting…' });

    try {
      const accessToken = (await getStoredAccessToken()) || (await syncVeeqoAccessToken(false));
      if (!accessToken) {
        throw new Error('Connect Veeqo in Settings before generating labels.');
      }
      const response = await chrome.runtime.sendMessage({
        action: 'generateDailyLabelsPdf',
        apiKey: accessToken,
        targetDate: labelDate || todayLocalYmd(),
        addTimestamp,
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

  const pdfFileName = useMemo(
    () =>
      buildPdfFileName(
        shareMessage,
        generatedPdf?.dateStr || labelDate || todayLocalYmd()
      ),
    [shareMessage, generatedPdf?.dateStr, labelDate]
  );

  const onDownloadPdf = async () => {
    if (!generatedPdf) return false;
    setShareNote(null);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadDailyLabelsPdf',
        pdfBase64: generatedPdf.pdfBase64,
        filename: pdfFileName,
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
      a.download = pdfFileName;
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

  const onShareNative = async () => {
    if (!generatedPdf) return;
    setShareNote(null);
    try {
      const subject = buildShareSubject(shareMessage, generatedPdf.dateStr);
      const file = new File(
        [base64ToBlob(generatedPdf.pdfBase64, 'application/pdf')],
        pdfFileName,
        { type: 'application/pdf' }
      );
      if (!navigator.canShare?.({ files: [file] })) {
        setShareNote(
          'This browser cannot attach PDFs via Share. Use the Email button for a .eml draft instead.'
        );
        return;
      }
      await navigator.share({
        files: [file],
        title: subject,
        text: subject,
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
    try {
      const subject = buildShareSubject(shareMessage, generatedPdf.dateStr);
      const body =
        `${subject}\n\n` +
        `Please find the UPS shipping labels PDF attached.\n\n` +
        `${generatedPdf.shipmentCount} label(s) shipped on ${generatedPdf.dateStr}.`;
      const emlBlob = buildEmailDraftEml({
        subject,
        body,
        pdfFileName,
        pdfBase64: generatedPdf.pdfBase64,
      });
      const emlName = pdfFileName.replace(/\.pdf$/i, '.eml');
      await downloadAndOpenFile(emlBlob, emlName);
      setShareNote('Opened a new email draft to send (subject + PDF attached). Fill in To and send.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLabelsError(msg);
    }
  };

  const onShareWhatsApp = async () => {
    if (!generatedPdf) return;
    setShareNote(null);
    const ok = await onDownloadPdf();
    if (!ok) return;
    const subject = buildShareSubject(shareMessage, generatedPdf.dateStr);
    const text = encodeURIComponent(
      `${subject}\n${generatedPdf.shipmentCount} label(s).\n` +
        `Please attach the downloaded file: ${pdfFileName}`
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
        <button
          type="button"
          className={'tab' + (activeTab === 'settings' ? ' active' : '')}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
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

        <div className="form-group">
          <label className="checkbox-row" htmlFor="addTimestamp">
            <input
              id="addTimestamp"
              type="checkbox"
              checked={addTimestamp}
              onChange={(e) => setAddTimestamp(e.target.checked)}
              disabled={labelsLoading}
            />
            <span>Add Timestamp</span>
          </label>
          <div className="help-text">
            When checked, each label is stamped with its buy time (local). Labels are always ordered
            by buy time.
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
              <strong>{pdfFileName}</strong>
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
              <strong>Email</strong> downloads a .eml draft (subject + PDF) and opens it as a new
              message to send. <strong>Share…</strong> uses the system share sheet. WhatsApp still
              needs you to attach the downloaded PDF.
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
            • If API connection fails, sign in with Google and Connect Veeqo again
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

      <div className={'tab-content' + (activeTab === 'settings' ? ' active' : '')} id="settings">
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Account</label>
            <div className="help-text" style={{ marginBottom: 8 }}>
              {auth?.googleSignedIn
                ? `Google: ${auth.email || 'signed in'}${auth.veeqoConnected ? ' · Veeqo connected' : ' · Veeqo not connected'}`
                : 'Sign in with an allowlisted Google account, then Connect Veeqo.'}
            </div>
            <div className="button-group" style={{ flexWrap: 'wrap' }}>
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
                  <button type="button" className="btn-secondary" disabled={authBusy} onClick={onRefreshAuth}>
                    Refresh status
                  </button>
                  {auth.veeqoConnected && (
                    <button type="button" className="btn-secondary" disabled={authBusy} onClick={onDisconnectVeeqo}>
                      Disconnect Veeqo
                    </button>
                  )}
                  <button type="button" className="btn-secondary" disabled={authBusy} onClick={onGoogleSignOut}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="workerUrl">Auth Worker URL</label>
            <input
              id="workerUrl"
              type="url"
              value={workerUrlInput}
              onChange={(e) => setWorkerUrlInput(e.target.value)}
              placeholder={DEFAULT_AUTH_WORKER_URL}
              autoComplete="off"
            />
            <div className="help-text">
              Cloudflare Worker that handles Google allowlist + Veeqo OAuth callback.
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
            <div className="setting-row">
              <label htmlFor="thankButtonColumn">Thank Button Column:</label>
              <input
                id="thankButtonColumn"
                type="number"
                min={1}
                max={20}
                value={thankButtonColumn}
                onChange={(e) => setThankButtonColumn(parseInt(e.target.value, 10) || 4)}
              />
            </div>
            <div className="help-text">Column number where the Thank button will be added (default: 4 — Order column)</div>
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
              Test Veeqo API
            </button>
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
          </div>
        </form>

        <div className={'status' + (status.show ? ' visible' : '') + (status.type ? ' ' + status.type : '')}>
          {status.message}
        </div>

        <div className="sku-records">
          <div className="sku-records-header">
            <h4>💌 Thank-You Card Links (by SKU)</h4>
            <div className="sku-records-header-actions">
              <button
                type="button"
                className="btn-secondary sku-records-import-btn"
                onClick={onExportSkuRecords}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn-secondary sku-records-import-btn"
                onClick={() => skuImportInputRef.current?.click()}
              >
                Import JSON…
              </button>
              <input
                ref={skuImportInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={onImportSkuRecordsFile}
              />
            </div>
          </div>
          <p className="help-text">
            Map a SKU to a custom item name and link. When printing a Thank-You card, the extension
            matches the order&apos;s SKU here — the QR code points at this link and the card shows this
            item name instead of the auto-detected product title. Orders with no matching SKU fall back
            to the product title and gocbepviet.com.
          </p>
          <p className="help-text">
            <strong>Import JSON</strong> expects an array like{' '}
            <code>{'[{"sku":"...","item":"...","link":"https://..."}]'}</code>. Records are merged into
            the list below by SKU (case-insensitive) — importing a SKU that already exists updates it in
            place.
          </p>

          {skuRecordsNote && <div className="status info visible">{skuRecordsNote}</div>}

          {skuRecords.length > 0 && (
            <div className="sku-records-list">
              <div className="sku-record-row sku-record-row--header">
                <span>SKU</span>
                <span>Item Name</span>
                <span>Link</span>
                <span />
              </div>
              {skuRecords.map((record, index) => (
                <div className="sku-record-row" key={index}>
                  <input
                    type="text"
                    value={record.sku}
                    onChange={(e) => onUpdateSkuRecordField(index, 'sku', e.target.value)}
                    placeholder="SKU"
                    aria-label="SKU"
                  />
                  <input
                    type="text"
                    value={record.itemName}
                    onChange={(e) => onUpdateSkuRecordField(index, 'itemName', e.target.value)}
                    placeholder="Item name"
                    aria-label="Item name"
                  />
                  <input
                    type="text"
                    value={record.link}
                    onChange={(e) => onUpdateSkuRecordField(index, 'link', e.target.value)}
                    onBlur={(e) => onUpdateSkuRecordField(index, 'link', normalizeLink(e.target.value))}
                    placeholder="https://…"
                    aria-label="Link"
                  />
                  <button
                    type="button"
                    className="sku-record-remove"
                    aria-label={`Remove record for ${record.sku || 'this SKU'}`}
                    onClick={() => onRemoveSkuRecord(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="sku-record-row sku-record-row--new" onSubmit={onAddSkuRecord}>
            <input
              type="text"
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder="SKU"
              aria-label="New SKU"
            />
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name"
              aria-label="New item name"
            />
            <input
              type="text"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="https://…"
              aria-label="New link"
            />
            <button type="submit" className="sku-record-add">
              Add
            </button>
          </form>

          {skuRecordsError && <div className="status error visible">{skuRecordsError}</div>}
        </div>
      </div>


    </div>
  );
}
