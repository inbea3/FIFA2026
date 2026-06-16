import { getTeamFlagUrl } from '../utils/teamFlag';

interface Props {
  name: string;
  nameZh: string;
  align?: 'left' | 'center' | 'right';
  size?: number;
}

export default function TeamLabel({ name, nameZh, align = 'center', size = 40 }: Props) {
  const flagUrl = getTeamFlagUrl(name, nameZh, size);

  return (
    <span className={`team-label team-label-${align}`}>
      {flagUrl && (
        <img
          src={flagUrl}
          alt=""
          className="team-flag-img"
          width={22}
          height={16}
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="team-label-name">{nameZh}</span>
    </span>
  );
}
