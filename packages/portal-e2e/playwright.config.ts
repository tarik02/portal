import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? '41006');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './src',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }], ['list']] : [['list']],
    expect: {
        toHaveScreenshot: {
            maxDiffPixels: 100,
            scale: 'css',
        },
    },
    use: {
        baseURL,
        browserName: 'chromium',
        viewport: {
            height: 1200,
            width: 1440,
        },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
});
