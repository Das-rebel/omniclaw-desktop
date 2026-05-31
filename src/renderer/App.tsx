import './App.scss';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { OmniClawProvider } from './context/OmniClawContext';
import { ToastsContextProvider } from './context/ToastsContext';
import Sidebar from './components/Sidebar';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Settings from './pages/Settings';
import Notebook from './pages/Notebook';
import Toasts from './components/Toasts';
import { useState, ReactNode } from 'react';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const transition = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 20,
  duration: 0.1,
};

const AnimatedPage = ({
  children,
  pageKey = '',
}: {
  children: ReactNode;
  pageKey?: string;
}) => {
  return (
    <motion.div
      key={pageKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ ...transition }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
};

export default function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <OmniClawProvider>
      <ToastsContextProvider>
        <div className="app-layout">
          <div className="title-bar" />
          {window.electron.isMac && <div className="title-bar-buttons" />}
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <div className="app-main">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
                  element={
                    <AnimatedPage pageKey="chat">
                      <Chat sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                    </AnimatedPage>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <AnimatedPage pageKey="dashboard">
                      <Dashboard />
                    </AnimatedPage>
                  }
                />
                <Route
                  path="/services"
                  element={
                    <AnimatedPage pageKey="services">
                      <Services />
                    </AnimatedPage>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <AnimatedPage pageKey="settings">
                      <Settings />
                    </AnimatedPage>
                  }
                />
                <Route
                  path="/notebook"
                  element={
                    <AnimatedPage pageKey="notebook">
                      <Notebook />
                    </AnimatedPage>
                  }
                />
              </Routes>
            </AnimatePresence>
          </div>
        </div>
        <Toasts />
      </ToastsContextProvider>
    </OmniClawProvider>
  );
}