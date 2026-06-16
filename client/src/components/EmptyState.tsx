interface Props {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon = '⚽', title, description }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
    </div>
  );
}
