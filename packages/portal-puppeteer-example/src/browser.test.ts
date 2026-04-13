import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vite-plus/test';

import { launch } from 'puppeteer';

import { createPuppeteerBrowserRuntime } from './browser';

vi.mock('puppeteer', () => ({
    launch: vi.fn(),
}));

describe('puppeteer browser runtime', () => {
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
        const browser = {
            close: vi.fn(async () => {
                browserEmitter.emit('disconnected');
            }),
            newPage: vi.fn(async () => page),
            off: vi.fn(),
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                browserEmitter.on(event, handler);
            }),
        };

        vi.mocked(launch).mockResolvedValue(browser as never);

        const runtime = await createPuppeteerBrowserRuntime();

        expect(launch).toHaveBeenCalledWith({ headless: true });
        expect(browser.newPage).toHaveBeenCalledTimes(1);
        expect(page.goto).toHaveBeenCalledWith('about:blank');
        expect(runtime.page$.value).toBe(page);

        await runtime.close();

        expect(page.close).toHaveBeenCalledTimes(1);
        expect(browser.close).toHaveBeenCalledTimes(1);
        expect(runtime.page$.value).toBeNull();
    });
});
