import { dealerApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

export default function DealerCustomers() {
  const resource = useAsync(() => dealerApi.contracts(undefined, 500), []);
  const customers = Array.from(
    new Map((resource.data?.data ?? []).map((contract) => [contract.companyId, {
      companyId: contract.companyId,
      companyName: contract.companyName ?? `Company ${contract.companyId}`,
      contracts: (resource.data?.data ?? []).filter((row) => row.companyId === contract.companyId),
    }])).values(),
  );
  return (
    <div>
      <PageHeader title="Customers" subtitle="Customer accounts derived from authoritative rental contracts" />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      <Panel>
        {resource.loading ? <PageSkeleton rows={6} /> : !customers.length ? <EmptyState title="No customer accounts yet" message="Customers appear when a rental contract is created." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Total contracts</th><th>Active</th><th>Overdue</th><th>Equipment</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.companyId}><td><strong>{customer.companyName}</strong><small>Company #{customer.companyId}</small></td><td>{customer.contracts.length}</td><td>{customer.contracts.filter((contract) => contract.rentalStatus === 'ACTIVE').length}</td><td>{customer.contracts.filter((contract) => contract.rentalStatus === 'OVERDUE').length}</td><td>{Array.from(new Set(customer.contracts.map((contract) => contract.equipmentName))).join(', ')}</td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
  );
}
