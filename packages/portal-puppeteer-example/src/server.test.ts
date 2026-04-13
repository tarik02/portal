import { EventEmitter } from 'node:events';
import { once } from 'node:events';
import http from 'node:http';

import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';
import WebSocket from 'ws';

import { createLengthPrefixedPacketCodec, type PortalPacket } from '@tarik02/portal-core';

import { createPuppeteerExampleServer } from './server';

const codec = createLengthPrefixedPacketCodec();

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
    const pageEmitter = new EventEmitter();
    const cdpEmitter = new EventEmitter();
    let currentUrl = 'about:blank';
    let closed = false;

    const cdpSession = {
        detach: vi.fn(async () => {
            cdpEmitter.emit('Detached');
        }),
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            cdpEmitter.off(event, handler);
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            cdpEmitter.on(event, handler);
        }),
        send: vi.fn(async (method: string) => {
            if (method !== 'Page.startScreencast') {
                return;
            }

            queueMicrotask(() => {
                cdpEmitter.emit('Page.screencastFrame', {
                    data: Buffer.from([7, 8, 9]).toString('base64'),
                    metadata: { width: 1, height: 1 },
                    sessionId: 1,
                });
            });
        }),
    };

    const page = {
        close: vi.fn(async () => {
            closed = true;
            pageEmitter.emit('close');
        }),
        createCDPSession: vi.fn(async () => cdpSession),
        goBack: vi.fn(async () => null),
        goForward: vi.fn(async () => null),
        goto: vi.fn(async (url: string) => {
            currentUrl = url;
            pageEmitter.emit('framenavigated');
        }),
        isClosed: vi.fn(() => closed),
        keyboard: {
            down: vi.fn(async () => {}),
            press: vi.fn(async () => {}),
            type: vi.fn(async () => {}),
            up: vi.fn(async () => {}),
        },
        mouse: {
            click: vi.fn(async () => {}),
            down: vi.fn(async () => {}),
            move: vi.fn(async () => {}),
            up: vi.fn(async () => {}),
            wheel: vi.fn(async () => {}),
        },
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            pageEmitter.off(event, handler);
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            pageEmitter.on(event, handler);
        }),
        reload: vi.fn(async () => {}),
        url: vi.fn(() => currentUrl),
    };
    const page$ = new BehaviorSubject<typeof page | null>(page);

    const runtime = {
        close: vi.fn(async () => {
            page$.next(null);
            await page.close();
            page$.complete();
        }),
        page$,
        resolvePage: vi.fn(async () => page),
    };

    return { page, runtime };
};

describe('puppeteer example server', () => {
    it('exposes only the websocket endpoint and handles navigation and view commands', async () => {
        const { page, runtime } = createFakeRuntime();
        const server = await createPuppeteerExampleServer({
            port: 0,
            createBrowserRuntime: async () => runtime as never,
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
