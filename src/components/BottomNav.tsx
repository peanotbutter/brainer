// The menu bar at the bottom of the screen, easy to reach with your thumb.

import Icon, { type IconName } from './Icon';

const ITEMS: { path: string; icon: IconName; label: string }[] = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/new', icon: 'plus', label: 'New' },
  { path: '/notes', icon: 'star', label: 'Notes' },
  { path: '/tasks', icon: 'check', label: 'Tasks' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

export default function BottomNav({ path }: { path: string }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <a
          key={item.path}
          href={`#${item.path}`}
          className={path === item.path ? 'active' : ''}
          aria-current={path === item.path ? 'page' : undefined}
        >
          <span className="nav-icon">
            <Icon name={item.icon} />
          </span>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
