import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onOfflineReady() {
    // App shell ready for offline launch
  },
});

createRoot(document.getElementById('root')!).render(<App />);
