import type { ReactNode } from 'react';

const alertTones = {
  info: 'border-brand-200 bg-brand-50 text-brand-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warn: 'border-accent-200 bg-accent-50 text-accent-800',
};

export function Alert({ tone = 'info', children }: { tone?: keyof typeof alertTones; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`animate-fade rounded-md border px-3 py-2 text-sm ${alertTones[tone]}`}>
      {children}
    </div>
  );
}

/** Feedback area shared by the dashboards. Renders nothing when both are empty. */
export function Feedback({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <div className="mt-4 space-y-2">
      {notice && <Alert>{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-ink-200" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            value === tab.id
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 text-xs text-ink-400">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
      <p className="font-medium text-ink-800">{title}</p>
      {children && <p className="muted mt-1">{children}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
