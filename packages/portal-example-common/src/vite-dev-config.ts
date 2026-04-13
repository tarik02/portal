import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';

export const portalClientViteBaseConfig = {
    plugins: [react(), tailwindcss()],
} satisfies InlineConfig;
