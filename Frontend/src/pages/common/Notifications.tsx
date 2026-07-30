import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { notifications } from '../../mock/data';

export default function NotificationsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Notifications" subtitle="Mock inbox" />
      <Panel>
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`flex gap-3 p-3 rounded-lg border ${
                n.read ? 'border-outline-variant/40 bg-surface' : 'border-primary/30 bg-primary-container/20'
              }`}
            >
              <span className="material-symbols-outlined text-primary">
                {n.read ? 'notifications' : 'notifications_active'}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                <p className="text-[11px] text-on-surface-variant">{n.time}</p>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
