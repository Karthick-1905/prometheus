import { useState } from 'react';
import { siteApi } from '../../api/platform';
import type { JsonRecord, Site } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { FeedbackBanner } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function OperatorScanQR() {
  const [mode, setMode] = useState<'qr' | 'rfid'>('qr');
  const [code, setCode] = useState('');
  const [siteId, setSiteId] = useState('');
  const [result, setResult] = useState<JsonRecord | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const sites = useAsync(() => siteApi.sites(), []);

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = mode === 'qr' ? await siteApi.byQr(code) : await siteApi.byRfid(code);
      setResult(response.data);
      setMessage({ tone: 'success', text: 'Equipment identifier verified.' });
    } catch (error) {
      setResult(null);
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const checkout = async (action: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!result || !siteId) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await siteApi.checkout({ action, siteId: Number(siteId), [mode === 'qr' ? 'qrCode' : 'rfidTag']: code, equipmentId: result.equipmentId });
      const warnings = (response.data.warnings as string[] | undefined) ?? [];
      setMessage({ tone: warnings.length ? 'warning' : 'success', text: `${action === 'CHECK_OUT' ? 'Check-out' : 'Check-in'} recorded.${warnings.length ? ` ${warnings.join(' ')}` : ''}` });
      setResult((current) => current ? { ...current, activeSiteId: action === 'CHECK_OUT' ? Number(siteId) : null } : current);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Scan Equipment" subtitle="Verify QR or RFID identifiers before check-in and check-out" />
      {message && <FeedbackBanner tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</FeedbackBanner>}
      <Panel>
        <form className="stack-form" onSubmit={lookup}>
          <div className="segmented"><button type="button" className={mode === 'qr' ? 'is-active' : ''} onClick={() => setMode('qr')}>QR code</button><button type="button" className={mode === 'rfid' ? 'is-active' : ''} onClick={() => setMode('rfid')}>RFID tag</button></div>
          <label className="field"><span>{mode === 'qr' ? 'QR code' : 'RFID tag'}</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder={mode === 'qr' ? 'QR-XXXXXXXX' : 'RFID-XXXXXXXX'} required /></label>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify equipment'}</button>
        </form>
        {result && <section className="scan-result"><header><div><h3>{String(result.equipmentName ?? `Equipment ${result.equipmentId}`)}</h3><p>{String(result.equipmentType ?? 'Unknown type')} · #{String(result.equipmentId)}</p></div><StatusBadge status={String(result.status ?? 'UNKNOWN')} /></header><dl className="detail-grid"><div><dt>Rental</dt><dd>{String(result.rentalStatus ?? 'No active contract')}</dd></div><div><dt>Current site</dt><dd>{String(result.activeSiteId ?? 'Not checked out')}</dd></div><div><dt>QR</dt><dd>{String(result.qrCode ?? '—')}</dd></div><div><dt>RFID</dt><dd>{String(result.rfidTag ?? '—')}</dd></div></dl><label className="field"><span>Site for this action</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)} required><option value="">Select site</option>{sites.data?.data.map((site: Site) => <option value={site.siteId} key={site.siteId}>{site.siteName}</option>)}</select></label><div className="scan-actions"><button className="btn-primary" type="button" disabled={!siteId || loading} onClick={() => void checkout('CHECK_OUT')}>Check out</button><button className="btn-secondary" type="button" disabled={!siteId || loading} onClick={() => void checkout('CHECK_IN')}>Check in</button></div></section>}
      </Panel>
    </div>
  );
}
