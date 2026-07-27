/**
 * Daily UPS shipping-label retrieval — port of Samples/retrieve_label.py
 */
import { PDFDocument } from 'pdf-lib';

const BASE_URL = 'https://api.veeqo.com';
const UPS_CARRIER_ID = 5;
const BATCH_SIZE = 50;

export type DailyLabelsProgress = {
  phase: 'fetching_orders' | 'downloading_labels' | 'merging' | 'done';
  message: string;
  page?: number;
  found?: number;
  batch?: number;
  totalBatches?: number;
};

export type DailyLabelsResult = {
  dateStr: string;
  shipmentIds: number[];
  filename: string;
  /** PDF bytes as base64 (no data: prefix) */
  pdfBase64: string;
};

type Shipment = Record<string, unknown>;
type Order = {
  allocations?: Array<{ shipment?: Shipment | null }>;
};

function parseTargetDay(targetDateStr?: string | null): {
  dateStr: string;
  dayStartMs: number;
  dayEndMs: number;
} {
  const now = new Date();
  let year: number;
  let month: number;
  let day: number;

  if (targetDateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDateStr);
    if (!m) throw new Error('Date must be YYYY-MM-DD');
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, dayStartMs: dayStart.getTime(), dayEndMs: dayEnd.getTime() };
}

function parseApiDatetime(value: unknown): number | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.replace('Z', '+00:00');
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

function trackingNumberText(shipment: Shipment): string {
  const tracking = shipment.tracking_number;
  if (tracking && typeof tracking === 'object') {
    const tn = (tracking as { tracking_number?: string }).tracking_number;
    return (tn || '').toUpperCase();
  }
  if (typeof tracking === 'string') return tracking.toUpperCase();
  return '';
}

export function isUpsShipment(shipment: Shipment): boolean {
  if (shipment.carrier_id === UPS_CARRIER_ID) return true;

  const sub = String(shipment.sub_carrier_id || '').toUpperCase();
  if (sub === 'UPS') return true;

  const serviceCarrier = String(shipment.service_carrier_name || '').toLowerCase();
  if (serviceCarrier === 'ups') return true;

  const serviceName = String(shipment.service_name || '').toLowerCase();
  const shortName = String(shipment.short_service_name || '').toLowerCase();
  if (serviceName.includes('ups') || shortName.includes('ups')) return true;

  const carrier = shipment.carrier;
  if (carrier && typeof carrier === 'object') {
    const c = carrier as { name?: string; slug?: string };
    const name = (c.name || '').toLowerCase();
    const slug = (c.slug || '').toLowerCase();
    if (name.includes('ups') || slug.includes('ups')) return true;
  } else if (typeof carrier === 'string' && carrier.toLowerCase().includes('ups')) {
    return true;
  }

  if (trackingNumberText(shipment).startsWith('1Z')) return true;
  return false;
}

function shipmentCreatedOnDay(
  shipment: Shipment,
  dayStartMs: number,
  dayEndMs: number
): boolean {
  const created = parseApiDatetime(shipment.created_at);
  if (created == null) return false;
  return created >= dayStartMs && created < dayEndMs;
}

function formatUpdatedAtMin(dayStartMs: number): string {
  const utc = new Date(dayStartMs);
  const y = utc.getUTCFullYear();
  const mo = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  const h = String(utc.getUTCHours()).padStart(2, '0');
  const mi = String(utc.getUTCMinutes()).padStart(2, '0');
  const s = String(utc.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

async function fetchOrdersPage(
  apiKey: string,
  updatedAtMin: string,
  page: number
): Promise<Order[]> {
  const params = new URLSearchParams({
    status: 'shipped',
    updated_at_min: updatedAtMin,
    page_size: '100',
    page: String(page),
  });
  const response = await fetch(`${BASE_URL}/orders?${params}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Orders fetch failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as Order[];
}

export async function getUpsShipmentIdsForDay(
  apiKey: string,
  targetDateStr?: string | null,
  onProgress?: (p: DailyLabelsProgress) => void
): Promise<{ shipmentIds: number[]; dateStr: string }> {
  const { dateStr, dayStartMs, dayEndMs } = parseTargetDay(targetDateStr);
  const updatedAtMin = formatUpdatedAtMin(dayStartMs);
  const shipmentIds: number[] = [];
  const seen = new Set<number>();
  let page = 1;

  onProgress?.({
    phase: 'fetching_orders',
    message: `Fetching shipped orders for ${dateStr}…`,
    page: 1,
    found: 0,
  });

  while (true) {
    const orders = await fetchOrdersPage(apiKey, updatedAtMin, page);
    if (!orders.length) break;

    for (const order of orders) {
      for (const allocation of order.allocations || []) {
        const shipment = allocation.shipment;
        if (!shipment) continue;
        const rawId = shipment.id;
        const shipmentId = typeof rawId === 'number' ? rawId : Number(rawId);
        if (!shipmentId || seen.has(shipmentId)) continue;
        if (!isUpsShipment(shipment)) continue;
        if (!shipmentCreatedOnDay(shipment, dayStartMs, dayEndMs)) continue;
        seen.add(shipmentId);
        shipmentIds.push(shipmentId);
      }
    }

    onProgress?.({
      phase: 'fetching_orders',
      message: `Processed page ${page} — found ${shipmentIds.length} UPS label(s)`,
      page,
      found: shipmentIds.length,
    });
    page += 1;
  }

  return { shipmentIds, dateStr };
}

async function downloadLabelsBatch(
  apiKey: string,
  shipmentIds: number[]
): Promise<Uint8Array> {
  const params = new URLSearchParams();
  for (const sid of shipmentIds) {
    params.append('shipment_ids[]', String(sid));
  }
  const response = await fetch(`${BASE_URL}/shipping/labels.pdf?${params}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/pdf',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Label download failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function mergePdfs(pdfBytesList: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytesList) {
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function fetchAndMergeLabels(
  apiKey: string,
  shipmentIds: number[],
  onProgress?: (p: DailyLabelsProgress) => void
): Promise<Uint8Array> {
  if (!shipmentIds.length) {
    throw new Error('No UPS shipping labels to download for this day.');
  }

  const totalBatches = Math.ceil(shipmentIds.length / BATCH_SIZE);
  onProgress?.({
    phase: 'downloading_labels',
    message: `Downloading labels for ${shipmentIds.length} shipment(s)…`,
    found: shipmentIds.length,
    batch: 0,
    totalBatches,
  });

  if (shipmentIds.length <= BATCH_SIZE) {
    try {
      const bytes = await downloadLabelsBatch(apiKey, shipmentIds);
      onProgress?.({
        phase: 'done',
        message: `Downloaded ${shipmentIds.length} label(s)`,
        found: shipmentIds.length,
      });
      return bytes;
    } catch {
      // fall through to chunked merge
    }
  }

  const batches: Uint8Array[] = [];
  for (let i = 0; i < shipmentIds.length; i += BATCH_SIZE) {
    const chunk = shipmentIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    onProgress?.({
      phase: 'downloading_labels',
      message: `Downloading batch ${batchNum}/${totalBatches} (${chunk.length} label(s))…`,
      found: shipmentIds.length,
      batch: batchNum,
      totalBatches,
    });
    batches.push(await downloadLabelsBatch(apiKey, chunk));
  }

  onProgress?.({
    phase: 'merging',
    message: `Merging ${batches.length} PDF batch(es)…`,
    found: shipmentIds.length,
  });
  const merged = await mergePdfs(batches);
  onProgress?.({
    phase: 'done',
    message: `Merged ${shipmentIds.length} label(s)`,
    found: shipmentIds.length,
  });
  return merged;
}

export async function generateDailyLabelsPdf(
  apiKey: string,
  targetDateStr?: string | null,
  onProgress?: (p: DailyLabelsProgress) => void
): Promise<DailyLabelsResult> {
  const { shipmentIds, dateStr } = await getUpsShipmentIdsForDay(
    apiKey,
    targetDateStr,
    onProgress
  );
  if (!shipmentIds.length) {
    throw new Error(`No UPS shipping labels found for ${dateStr}.`);
  }
  const pdfBytes = await fetchAndMergeLabels(apiKey, shipmentIds, onProgress);
  const filename = `UPS_Labels_${dateStr}.pdf`;
  return {
    dateStr,
    shipmentIds,
    filename,
    pdfBase64: uint8ToBase64(pdfBytes),
  };
}
