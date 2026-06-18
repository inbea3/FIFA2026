export const APP_MOTTO = '脱离金钱，回归本质，概率游戏';

export default function AppMotto({ variant = 'bar' }: { variant?: 'auth' | 'bar' }) {
  return <p className={`app-motto app-motto--${variant}`}>{APP_MOTTO}</p>;
}
