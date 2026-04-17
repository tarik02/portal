import { once } from 'node:events';
import http from 'node:http';

import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';
import WebSocket from 'ws';

import { createLengthPrefixedPacketCodec, type PortalPacket } from '@tarik02/portal-core';

import { createPuppeteerExampleServer } from './server';

const codec = createLengthPrefixedPacketCodec();

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

const waitFor = async <T>(read: () => T | undefined, timeoutMs = 2000) => {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
        const value = read();
        if (value !== undefined) {
            return value;
        }

        if (Date.now() > deadline) {
            throw new Error('timed out waiting for packet');
        }

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 10);
        });
    }
};

const toBytes = (value: unknown) => {
    if (typeof value === 'string') {
        return new TextEncoder().encode(value);
    }

    if (value instanceof Uint8Array) {
        return Uint8Array.from(value);
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    return Uint8Array.from(value as ArrayLike<number>);
};

const readResponse = async (url: string) =>
    await new Promise<{ body: string; statusCode: number }>((resolve, reject) => {
        let body = '';
        const request = http.get(url, (response) => {
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                resolve({
                    body,
                    statusCode: response.statusCode ?? 0,
                });
            });
        });

        request.on('error', reject);
    });

const createFakeRuntime = () => {
    const pageEmitter = createEventBus();
    const cdpEmitter = createEventBus();
    let currentUrl = 'about:blank';
    let closed = false;

    const cdpSession = {
        detach: vi.fn(() => {
            cdpEmitter.emit('Detached');
            return Promise.resolve();
        }),
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            cdpEmitter.off(event, handler);
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            cdpEmitter.on(event, handler);
        }),
        send: vi.fn((method: string) => {
            if (method !== 'Page.startScreencast') {
                return Promise.resolve();
            }

            queueMicrotask(() => {
                cdpEmitter.emit('Page.screencastFrame', {
                    data: Buffer.from([7, 8, 9]).toString('base64'),
                    metadata: { width: 1, height: 1 },
                    sessionId: 1,
                });
            });

            return Promise.resolve();
        }),
    };

    const page = {
        close: vi.fn(() => {
            closed = true;
            pageEmitter.emit('close');
            return Promise.resolve();
        }),
        createCDPSession: vi.fn(() => Promise.resolve(cdpSession)),
        goBack: vi.fn(() => Promise.resolve(null)),
        goForward: vi.fn(() => Promise.resolve(null)),
        goto: vi.fn((url: string) => {
            currentUrl = url;
            pageEmitter.emit('framenavigated');
            return Promise.resolve();
        }),
        isClosed: vi.fn(() => closed),
        keyboard: {
            down: vi.fn(() => Promise.resolve()),
            press: vi.fn(() => Promise.resolve()),
            type: vi.fn(() => Promise.resolve()),
            up: vi.fn(() => Promise.resolve()),
        },
        mouse: {
            click: vi.fn(() => Promise.resolve()),
            down: vi.fn(() => Promise.resolve()),
            move: vi.fn(() => Promise.resolve()),
            up: vi.fn(() => Promise.resolve()),
            wheel: vi.fn(() => Promise.resolve()),
        },
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            pageEmitter.off(event, handler);
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            pageEmitter.on(event, handler);
        }),
        reload: vi.fn(() => Promise.resolve()),
        url: vi.fn(() => currentUrl),
    };
    const page$ = new BehaviorSubject<typeof page | null>(page);

    const runtime = {
        close: vi.fn(() => {
            page$.next(null);
            void page.close();
            page$.complete();
            return Promise.resolve();
        }),
        page$,
        resolvePage: vi.fn(() => Promise.resolve(page)),
    };

    return { page, runtime };
};

describe('puppeteer example server', () => {
    it('exposes only the websocket endpoint and handles navigation and view commands', async () => {
        const { page, runtime } = createFakeRuntime();
        const server = await createPuppeteerExampleServer({
            port: 0,
            createBrowserRuntime: () => Promise.resolve(runtime as never),
        });

        const rootResponse = await readResponse(server.url.replace(/^ws/, 'http').replace(/\/portal$/, '/'));
        expect(rootResponse.statusCode).toBe(200);
        expect(rootResponse.body).toContain('__PORTAL_CLIENT_EXAMPLE_CONFIG__');
        expect(rootResponse.body).toContain('/portal');

        const client = new WebSocket(server.url);
        const packets: PortalPacket[] = [];

        client.on('message', (data) => {
            packets.push(...codec.decode(toBytes(data)));
        });

        await once(client, 'open');

        const hello = await waitFor(() =>
            packets.find((packet) => {
                if (packet.kind !== 'json') {
                    return false;
                }

                return (packet.value as Record<string, unknown>).type === 'hello';
            }),
        );
        expect(hello?.kind).toBe('json');
        expect(hello?.kind === 'json' ? hello.value : null).toMatchObject({
            type: 'hello',
            location: 'about:blank',
        });

        client.send(
            codec.encode({
                kind: 'json',
                value: {
                    requestId: 'goto-1',
                    type: 'navigate.goto',
                    url: 'https://example.com/post/1',
                },
            }),
        );

        await waitFor(() =>
            packets.find((packet) => {
                if (packet.kind !== 'json') {
                    return false;
                }

                const value = packet.value as Record<string, unknown>;
                return value.type === 'location.changed' && value.url === 'https://example.com/post/1';
            }),
        );
        await waitFor(() =>
            packets.find((packet) => {
                if (packet.kind !== 'json') {
                    return false;
                }

                const value = packet.value as Record<string, unknown>;
                return value.type === 'command.result' && value.requestId === 'goto-1';
            }),
        );
        expect(page.goto).toHaveBeenCalledWith('https://example.com/post/1');

        client.send(
            codec.encode({
                kind: 'json',
                value: {
                    requestId: 'view-1',
                    type: 'view.start',
                },
            }),
        );

        const frameMeta = await waitFor(() =>
            packets.find((packet) => {
                if (packet.kind !== 'json') {
                    return false;
                }

                return (packet.value as Record<string, unknown>).type === 'view.frame-meta';
            }),
        );
        const frame = await waitFor(() =>
            packets.find((packet) => packet.kind === 'binary' && packet.channel === 'view.frame'),
        );
        const viewResult = await waitFor(() =>
            packets.find((packet) => {
                if (packet.kind !== 'json') {
                    return false;
                }

                const value = packet.value as Record<string, unknown>;
                return value.type === 'command.result' && value.requestId === 'view-1';
            }),
        );

        expect(frameMeta?.kind).toBe('json');
        expect(frame?.kind).toBe('binary');
        expect(viewResult?.kind).toBe('json');

        client.close();
        await server.close();

        expect(runtime.close).toHaveBeenCalledTimes(1);
    });
});
