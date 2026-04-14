import { describe, expect, it, vi } from 'vite-plus/test';

import { chromium } from 'playwright';

import { createPlaywrightBrowserRuntime } from './browser';

type EventBus = {
    emit: (event: string, ...args: unknown[]) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
};

const createEventBus = (): EventBus => {
    const target = new EventTarget();
    const handlers = new Map<string, Map<(...args: unknown[]) => void, EventListener>>();

    const on = (event: string, handler: (...args: unknown[]) => void) => {
        const listener = ((entry: Event) => {
            const detail = (entry as CustomEvent<unknown[]>).detail ?? [];
            handler(...(Array.isArray(detail) ? detail : [detail]));
        }) as EventListener;

        const eventHandlers = handlers.get(event) ?? new Map();
        eventHandlers.set(handler, listener);
        handlers.set(event, eventHandlers);
        target.addEventListener(event, listener);
    };

    const off = (event: string, handler: (...args: unknown[]) => void) => {
        const eventHandlers = handlers.get(event);
        if (!eventHandlers) {
            return;
        }

        const listener = eventHandlers.get(handler);
        if (!listener) {
            return;
        }

        target.removeEventListener(event, listener);
        eventHandlers.delete(handler);
        if (eventHandlers.size === 0) {
            handlers.delete(event);
        }
    };

    const emit = (event: string, ...args: unknown[]) => {
        target.dispatchEvent(new CustomEvent(event, { detail: args }));
    };

    return {
        emit,
        off,
        on,
    };
};

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn(),
    },
}));

describe('playwright browser runtime', () => {
    it('launches the browser and closes resources in order', async () => {
        const pageEmitter = createEventBus();
        const browserEmitter = createEventBus();
        const page = {
            close: vi.fn(() => {
                pageEmitter.emit('close');
                return Promise.resolve();
            }),
            goto: vi.fn(() => Promise.resolve()),
            off: vi.fn(),
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                pageEmitter.on(event, handler);
            }),
        };
        const context = {
            close: vi.fn(() => Promise.resolve()),
            newPage: vi.fn(() => Promise.resolve(page)),
        };
        const browser = {
            close: vi.fn(() => {
                browserEmitter.emit('disconnected');
                return Promise.resolve();
            }),
            newContext: vi.fn(() => Promise.resolve(context)),
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
