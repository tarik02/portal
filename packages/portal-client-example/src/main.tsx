import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HotkeysProvider } from '@tanstack/react-hotkeys';

import { App } from './App';
import './styles.css';

const root = document.querySelector('#root');

if (!root) {
    throw new Error('Missing #root element for portal client example');
}

createRoot(root).render(
    <StrictMode>
        <HotkeysProvider>
            <App />
        </HotkeysProvider>
    </StrictMode>,
);
