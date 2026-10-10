import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './ui/App';
import { installAppUpdates } from './ui/appUpdate';
import './ui/styles.css';
import './ui/game.css';
import './ui/meta.css';
import './ui/menu.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

installAppUpdates();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
