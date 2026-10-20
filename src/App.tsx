// The app's frame: picks which screen to show and draws the bottom menu.

import { useEffect } from 'react';
import { usePath } from './lib/router';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import HomeScreen from './screens/HomeScreen';
import NewPackScreen from './screens/NewPackScreen';
import ComingSoon from './screens/ComingSoon';
import LessonScreen from './screens/LessonScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const path = usePath();

  // Start each new screen at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  let screen;
  switch (path) {
    case '/':
      screen = <HomeScreen />;
      break;
    case '/new':
      screen = <NewPackScreen />;
      break;
    case '/notes':
      screen = <ComingSoon title="Notes" phase={3} />;
      break;
    case '/tasks':
      screen = <ComingSoon title="Tasks" phase={3} />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    default:
      // e.g. /lesson/biz-001
      if (path.startsWith('/lesson/')) {
        screen = <LessonScreen id={decodeURIComponent(path.slice('/lesson/'.length))} />;
      } else {
        screen = <HomeScreen />;
      }
  }

  return (
    <>
      <TopBar />
      <main className="screen">{screen}</main>
      <BottomNav path={path} />
    </>
  );
}
