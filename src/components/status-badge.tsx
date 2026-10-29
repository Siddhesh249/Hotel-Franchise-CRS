import { Icon, type IconName } from '@/components/icons';

type Tone = 'brand' | 'amber' | 'rose' | 'slate';

const styles: Record<Tone, string> = {
  brand: 'badge-brand',
  amber: 'badge-amber',
  rose: 'badge-rose',
  slate: 'badge-slate',
};

const meta: Record<string, { label: string; tone: Tone; icon: IconName }> = {
  Confirmed: { label: 'Confirmed', tone: 'brand', icon: 'check' },
  CONFIRMED: { label: 'Confirmed', tone: 'brand', icon: 'check' },
  CONFIRMED_OVERBOOKED: { label: 'Confirmed · buffer', tone: 'amber', icon: 'sparkles' },
  Waitlisted: { label: 'Waitlisted', tone: 'amber', icon: 'clock' },
  WAITLISTED: { label: 'Waitlisted', tone: 'amber', icon: 'clock' },
  CheckedIn: { label: 'Checked in', tone: 'brand', icon: 'bed' },
  CheckedOut: { label: 'Checked out', tone: 'slate', icon: 'check' },
  Cancelled: { label: 'Cancelled', tone: 'rose', icon: 'x' },
  NoShow: { label: 'No-show', tone: 'rose', icon: 'alert' },
  Pending: { label: 'Payment pending', tone: 'amber', icon: 'clock' },
  Completed: { label: 'Paid', tone: 'brand', icon: 'check' },
  Refunded: { label: 'Refunded', tone: 'slate', icon: 'refresh' },
  Failed: { label: 'Payment failed', tone: 'rose', icon: 'alert' },
  Available: { label: 'Available', tone: 'brand', icon: 'check' },
  Maintenance: { label: 'Maintenance', tone: 'amber', icon: 'alert' },
  OutOfService: { label: 'Out of service', tone: 'rose', icon: 'alert' },
};

export function StatusBadge({ status, className = '' }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className={`${styles.slate} ${className}`}>Unknown</span>;
  const item = meta[status] ?? { label: status, tone: 'slate' as Tone, icon: 'info' as IconName };
  return (
    <span className={`${styles[item.tone]} ${className}`}>
      <Icon name={item.icon} size={12} />
      {item.label}
    </span>
  );
}
