// The bar at the top of every screen with the Brainer name.

import Icon from './Icon';

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="logo">
          <Icon name="brain" />
        </span>
        <a href="#/" className="brand">
          Brain<span className="gold">er</span>
        </a>
      </div>
    </header>
  );
}
