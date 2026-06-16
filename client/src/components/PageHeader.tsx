interface Props {
  title: string;
  subtitle?: string;
  badge?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, badge, children }: Props) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        <div>
          <div className="page-header-title-row">
            <h2 className="page-title">{title}</h2>
            {badge && <span className="page-badge">{badge}</span>}
          </div>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
