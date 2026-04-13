import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vite-plus/test';

import { chromium } from 'playwright';

import { createPlaywrightBrowserRuntime } from './browser';

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn(),
    },
}));

describe('playwright browser runtime', () => {
    it('launches the browser and closes resources in order', async () => {
        const pageEmitter = new EventEmitter();
        const browserEmitter = new EventEmitter();
        const page = {
            close: vi.fn(async () => {
                pageEmitter.emit('close');
            }),
            goto: vi.fn(async () => {}),
            off: vi.fn(),
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                pageEmitter.on(event, handler);
            }),
        };
        const context = {
            close: vi.fn(async () => {}),
            newPage: vi.fn(async () => page),
        };
        const browser = {
            close: vi.fn(async () => {
                browserEmitter.emit('disconnected');
            }),
            newContext: vi.fn(async () => context),
            off: vi.fn(),
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                browserEmitter.on(event, handler);
            }),
        };

        vi.mocked(chromium.launch).mockResolvedValue(browser as never);

        const runtime = await createPlaywrightBrowserRuntime();

        expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
        expect(context.newPage).toHaveBeenCalledTimes(1);
        expect(page.goto).toHaveBeenCalledWith('about:blank');
        expect(runtime.page$.value).toBe(page);

        await runtime.close();

        expect(page.close).toHaveBeenCalledTimes(1);
        expect(context.close).toHaveBeenCalledTimes(1);
        expect(browser.close).toHaveBeenCalledTimes(1);
        expect(runtime.page$.value).toBeNull();
    });
});
