import { describe, expect, it } from 'vitest';
import { formatBuyTimeLocal, isUpsShipment } from './dailyLabels';

describe('formatBuyTimeLocal', () => {
  it('returns a Bought: stamp for a timestamp', () => {
    const stamp = formatBuyTimeLocal(Date.UTC(2024, 0, 15, 12, 30, 0));
    expect(stamp.startsWith('Bought:')).toBe(true);
    expect(stamp.length).toBeGreaterThan('Bought:'.length + 5);
  });
});

describe('isUpsShipment', () => {
  it('matches carrier_id 5', () => {
    expect(isUpsShipment({ carrier_id: 5 })).toBe(true);
  });

  it('matches sub_carrier_id UPS', () => {
    expect(isUpsShipment({ sub_carrier_id: 'ups' })).toBe(true);
  });

  it('matches service_carrier_name', () => {
    expect(isUpsShipment({ service_carrier_name: 'UPS' })).toBe(true);
  });

  it('matches service_name / short_service_name containing ups', () => {
    expect(isUpsShipment({ service_name: 'UPS Ground' })).toBe(true);
    expect(isUpsShipment({ short_service_name: 'ups' })).toBe(true);
  });

  it('matches carrier object name/slug', () => {
    expect(isUpsShipment({ carrier: { name: 'United Parcel Service', slug: 'ups' } })).toBe(true);
    expect(isUpsShipment({ carrier: 'UPS' })).toBe(true);
  });

  it('matches 1Z tracking numbers', () => {
    expect(
      isUpsShipment({
        tracking_number: { tracking_number: '1Z999AA10123456784' },
      })
    ).toBe(true);
    expect(isUpsShipment({ tracking_number: '1zabc' })).toBe(true);
  });

  it('returns false for non-UPS shipments', () => {
    expect(isUpsShipment({ carrier_id: 29, service_name: 'USPS Priority' })).toBe(false);
    expect(isUpsShipment({ tracking_number: { tracking_number: '9400111899223344556677' } })).toBe(
      false
    );
  });
});
