import os
from datetime import datetime, timedelta, timezone

import requests
from pypdf import PdfWriter

# Configuration
API_KEY = os.environ.get("VEEQO_API_KEY", "Vqt/8ab1681762fab6aabf36afb3b3836a8f")
BASE_URL = "https://api.veeqo.com"
UPS_CARRIER_ID = 5  # Veeqo's Carrier ID for UPS
# Use this machine's local timezone for "today" / a specific calendar day
LOCAL_TZ = datetime.now().astimezone().tzinfo
# Max shipment IDs per labels.pdf request (avoids overly long URLs)
BATCH_SIZE = 50

headers = {
    "x-api-key": API_KEY,
    "Accept": "application/json",
}


def parse_target_day(target_date_str=None):
    """
    Resolve a local calendar day window [start, end).
    Defaults to today in LOCAL_TZ. Returns (date_str, day_start, day_end).
    """
    if target_date_str:
        day = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    else:
        day = datetime.now(LOCAL_TZ).date()

    day_start = datetime(day.year, day.month, day.day, tzinfo=LOCAL_TZ)
    day_end = day_start + timedelta(days=1)
    return day.strftime("%Y-%m-%d"), day_start, day_end


def parse_api_datetime(value):
    """Parse Veeqo ISO timestamps into timezone-aware datetimes."""
    if not value:
        return None
    # e.g. 2026-07-27T15:04:05.123Z or without Z/fraction
    normalized = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def is_ups_shipment(shipment):
    """
    True for direct UPS (carrier_id 5) and Amazon Buy Shipping UPS
    (carrier_id 33 with sub_carrier_id / service fields).
    """
    if shipment.get("carrier_id") == UPS_CARRIER_ID:
        return True

    sub = (shipment.get("sub_carrier_id") or "").upper()
    if sub == "UPS":
        return True

    service_carrier = (shipment.get("service_carrier_name") or "").lower()
    if service_carrier == "ups":
        return True

    service_name = (shipment.get("service_name") or "").lower()
    short_name = (shipment.get("short_service_name") or "").lower()
    if "ups" in service_name or "ups" in short_name:
        return True

    carrier = shipment.get("carrier") or {}
    if isinstance(carrier, dict):
        name = (carrier.get("name") or "").lower()
        slug = (carrier.get("slug") or "").lower()
        if "ups" in name or "ups" in slug:
            return True
    elif isinstance(carrier, str) and "ups" in carrier.lower():
        return True

    tracking = shipment.get("tracking_number")
    if isinstance(tracking, dict):
        tn = (tracking.get("tracking_number") or "").upper()
    else:
        tn = (tracking or "").upper() if isinstance(tracking, str) else ""
    if tn.startswith("1Z"):
        return True

    return False


def shipment_created_on_day(shipment, day_start, day_end):
    created = parse_api_datetime(shipment.get("created_at"))
    if not created:
        return False
    return day_start <= created < day_end


def get_ups_shipment_ids_for_day(target_date_str=None):
    """
    Find UPS shipments whose labels were created on the target local day.
    Uses order updated_at_min as a coarse API filter, then filters by
    shipment.created_at within [day_start, day_end).
    """
    date_str, day_start, day_end = parse_target_day(target_date_str)

    # Coarse filter: orders touched since start of that local day (as UTC)
    updated_at_min = day_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    shipment_ids = []
    seen = set()
    page = 1

    print(
        f"Fetching shipped orders updated since {updated_at_min} UTC "
        f"(labels for local day {date_str})..."
    )

    while True:
        params = {
            "status": "shipped",
            "updated_at_min": updated_at_min,
            "page_size": 100,
            "page": page,
        }

        response = requests.get(f"{BASE_URL}/orders", headers=headers, params=params)
        response.raise_for_status()
        orders = response.json()

        if not orders:
            break

        for order in orders:
            for allocation in order.get("allocations", []):
                shipment = allocation.get("shipment")
                if not shipment:
                    continue

                shipment_id = shipment.get("id")
                if not shipment_id or shipment_id in seen:
                    continue
                if not is_ups_shipment(shipment):
                    continue
                if not shipment_created_on_day(shipment, day_start, day_end):
                    continue

                seen.add(shipment_id)
                shipment_ids.append(shipment_id)

        print(f"Processed page {page} ({len(orders)} orders)")
        page += 1

    print(f"Found {len(shipment_ids)} UPS shipment(s) created on {date_str}.")
    return shipment_ids, date_str


def download_labels_batch(shipment_ids, output_filename):
    """Download labels for many shipment IDs in one API call."""
    label_headers = {
        "x-api-key": API_KEY,
        "Accept": "application/pdf",
    }
    # requests encodes repeated keys as shipment_ids[]=1&shipment_ids[]=2...
    params = [("shipment_ids[]", sid) for sid in shipment_ids]

    response = requests.get(
        f"{BASE_URL}/shipping/labels.pdf",
        headers=label_headers,
        params=params,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Batch label download failed ({response.status_code}): {response.text[:200]}"
        )

    with open(output_filename, "wb") as f:
        f.write(response.content)


def fetch_and_merge_labels(shipment_ids, output_filename):
    """
    Download label PDFs in batches and write a single merged PDF.
    Prefer Veeqo's multi-ID response; fall back to smaller batches + merge.
    """
    if not shipment_ids:
        print("No UPS shipping labels to download.")
        return

    print(f"Downloading labels for {len(shipment_ids)} shipment(s)...")

    # Try one shot if the list is small enough
    if len(shipment_ids) <= BATCH_SIZE:
        try:
            download_labels_batch(shipment_ids, output_filename)
            print(f"\nSuccess! Saved {len(shipment_ids)} label(s) to '{output_filename}'.")
            return
        except RuntimeError as exc:
            print(f"Single-batch download failed ({exc}); retrying in chunks...")

    # Chunked download + local merge
    merger = PdfWriter()
    temp_files = []

    try:
        for i in range(0, len(shipment_ids), BATCH_SIZE):
            chunk = shipment_ids[i : i + BATCH_SIZE]
            temp_pdf = f"temp_labels_batch_{i // BATCH_SIZE + 1}.pdf"
            download_labels_batch(chunk, temp_pdf)
            merger.append(temp_pdf)
            temp_files.append(temp_pdf)
            print(f"Downloaded batch {i // BATCH_SIZE + 1} ({len(chunk)} label(s))")

        with open(output_filename, "wb") as out_file:
            merger.write(out_file)
    finally:
        merger.close()
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    print(f"\nSuccess! Merged {len(shipment_ids)} label(s) into '{output_filename}'.")


if __name__ == "__main__":
    # Specify date in YYYY-MM-DD (local timezone), or None for today
    target_date = None  # e.g., "2026-07-27"

    shipment_ids, date_used = get_ups_shipment_ids_for_day(target_date)
    output_pdf = f"UPS_Labels_{date_used}.pdf"

    fetch_and_merge_labels(shipment_ids, output_pdf)
