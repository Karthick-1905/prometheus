import { dealerApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

const n = (value: unknown) => Number(value ?? 0);

export default function DealerDashboard() {
  const resource = useAsync(async () => {
    const [profile, summary, equipment, contracts] = await Promise.all([
      dealerApi.me(),
      dealerApi.summary(),
      dealerApi.equipment({ limit: 8 }),
      dealerApi.contracts(undefined, 8),
    ]);
    return { profile: profile.data, summary: summary.data, equipment: equipment.data, contracts: contracts.data };
  }, []);
  const totals = (resource.data?.summary.totals ?? {}) as Record<string, unknown>;
  return (
    <div>
      <PageHeader
        title="Dealer Dashboard"
        subtitle={resource.data ? `${String(resource.data.profile.dealerName)} · live inventory and contracts` : 'Live inventory and contracts'}
        actions={
          <button className="btn-secondary" type="button" onClick={() => void resource.reload()} disabled={resource.loading} aria-busy={resource.loading}>
            <span className={`material-symbols-outlined text-base ${resource.loading ? 'is-spinning' : ''}`} aria-hidden="true">refresh</span>
            {resource.loading ? 'Refreshing' : 'Refresh'}
          </button>
        }
      />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={8} /> : (
        <div className="dashboard-content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Equipment" value={n(totals.equipment)} icon="construction" />
            <StatCard label="Available" value={n(totals.available)} icon="check_circle" accent="success" />
            <StatCard label="Active contracts" value={n(totals.activeContracts)} icon="assignment" />
            <StatCard label="Overdue" value={n(totals.overdueContracts)} icon="event_busy" accent="warning" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Recent contracts"><div className="data-list">{resource.data?.contracts.map((contract) => <div className="data-list-row compact" key={contract.contractId}><div><strong>{contract.companyName ?? `Company ${contract.companyId}`}</strong><span>{contract.equipmentName ?? `Equipment ${contract.equipmentId}`} · Contract #{contract.contractId}</span></div><strong>{contract.rentalStatus}</strong></div>)}</div></Panel>
            <Panel title="Inventory mix"><div className="data-list">{Object.entries((resource.data?.summary.equipmentByStatus ?? {}) as Record<string, unknown>).map(([status, value]) => <div className="data-list-row compact" key={status}><strong>{status}</strong><span>{n(value)} units</span></div>)}</div></Panel>
          </div>
        </div>
      )}
    </div>
  );
}
