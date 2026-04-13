import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { AddressInfo, Socket } from 'node:net';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { IncomingMessage } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';

import {
    attachPortalConnection,
    createPortalRoomManager,
    createWebSocketServerTransport,
    type PortalBackend,
} from '@tarik02/portal-server';

export type PortalExampleEmbeddedConfig = {
    portalUrl: string;
    hidePortalInput: boolean;
};

export type PortalExampleServer = {
    readonly port: number;
    readonly url: string;
    close: () => Promise<void>;
};

export type PortalExampleServerOptions<TBrowserRuntime extends { close: () => Promise<void> }> = {
    readonly host?: string;
    readonly port?: number;
    readonly portalPath?: string;
    readonly indexHtmlPath: string;
    readonly assetsDir: string;
    readonly embeddedConfig: PortalExampleEmbeddedConfig;
    readonly createBrowserRuntime: () => Promise<TBrowserRuntime>;
    readonly createBackend: (browserRuntime: TBrowserRuntime) => Promise<PortalBackend> | PortalBackend;
};

export type PortalExampleRuntimeServerOptions<TBrowserRuntime extends { close: () => Promise<void> }> = {
    readonly host?: string;
    readonly port?: number;
    readonly portalPath?: string;
    readonly createBrowserRuntime: () => Promise<TBrowserRuntime>;
    readonly createBackend: (browserRuntime: TBrowserRuntime) => Promise<PortalBackend> | PortalBackend;
};

const readPort = (server: ReturnType<typeof serve>) => {
    const address = server.address();
    if (address === null) {
        throw new Error('portal example server is not listening');
    }

    if (typeof address === 'string') {
        throw new TypeError(`unexpected socket address: ${address}`);
    }

    return (address as AddressInfo).port;
};

const waitForListening = async (server: ReturnType<typeof serve>) =>
    await new Promise<number>((resolveAddress, reject) => {
        const currentAddress = server.address();
        if (currentAddress !== null && typeof currentAddress !== 'string') {
            resolveAddress((currentAddress as AddressInfo).port);
            return;
        }

        const onListening = () => {
            cleanup();
            resolveAddress(readPort(server));
        };

        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        const cleanup = () => {
            server.off('listening', onListening);
            server.off('error', onError);
        };

        server.once('listening', onListening);
        server.once('error', onError);
    });

const toUrl = (host: string, port: number, portalPath: string) => `ws://${host}:${port}${portalPath}`;

const escapeEmbeddedJson = (value: unknown) =>
    JSON.stringify(value)
        .replaceAll('<', String.raw`\u003c`)
        .replaceAll('\u2028', String.raw`\u2028`)
        .replaceAll('\u2029', String.raw`\u2029`);

const injectPortalConfig = (html: string, config: PortalExampleEmbeddedConfig) => {
    const script = `<script>window.__PORTAL_CLIENT_EXAMPLE_CONFIG__ = ${escapeEmbeddedJson(config)};</script>`;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n</head>`);
    }

    return `${script}\n${html}`;
};

const readStaticFile = async (pathname: string, assetsDir: string) => {
    const resolvedAssetsDir = `${resolve(assetsDir)}${sep}`;
    const assetPath = resolve(assetsDir, pathname.replace(/^\/assets\/?/, ''));
    if (!assetPath.startsWith(resolvedAssetsDir)) {
        return new Response('not found', {
            status: 404,
        });
    }

    let file: Buffer;
    try {
        file = await readFile(assetPath);
    } catch {
        return new Response('not found', {
            status: 404,
        });
    }

    const contentType = (() => {
        switch (extname(assetPath)) {
            case '.js': {
                return 'text/javascript; charset=utf-8';
            }
            case '.css': {
                return 'text/css; charset=utf-8';
            }
            case '.html': {
                return 'text/html; charset=utf-8';
            }
            case '.svg': {
                return 'image/svg+xml';
            }
            case '.json': {
                return 'application/json; charset=utf-8';
            }
            default: {
                return 'application/octet-stream';
            }
        }
    })();

    return new Response(new Uint8Array(file), {
        headers: {
            'content-type': contentType,
        },
    });
};

const createPortalExampleServerBase = async <TBrowserRuntime extends { close: () => Promise<void> }>({
    host = '127.0.0.1',
    port = 0,
    portalPath = '/portal',
    createBrowserRuntime,
    createBackend,
    configureApp,
}: PortalExampleRuntimeServerOptions<TBrowserRuntime> & {
    configureApp?: (app: Hono) => void;
}): Promise<PortalExampleServer> => {
    const roomManager = createPortalRoomManager();
    const browserRuntime = await createBrowserRuntime();
    const app = new Hono();
    const wsServer = new WebSocketServer({ noServer: true });
    const activeConnections = new Set<() => Promise<void>>();
    let closed = false;

    configureApp?.(app);
    app.notFound((c) => c.text('not found', 404));

    const server = serve({
        fetch: app.fetch,
        hostname: host,
        port,
    });
    const listeningPort = await waitForListening(server);

    const releaseConnection = async (release: () => Promise<void>) => {
        if (!activeConnections.delete(release)) {
            return;
        }

        await release();
    };

    const upgradeHandler = (request: IncomingMessage, socket: Socket, head: Buffer) => {
        const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
        if (requestUrl.pathname !== portalPath) {
            return;
        }

        wsServer.handleUpgrade(request, socket, head, (browserSocket) => {
            void (async () => {
                let transport: ReturnType<typeof createWebSocketServerTransport> | null = null;

                try {
                    transport = createWebSocketServerTransport(browserSocket);
                    const backend = await createBackend(browserRuntime);
                    const connection = await attachPortalConnection({
                        roomManager,
                        roomId: 'portal',
                        transport,
                        createBackend: () => backend,
                    });

                    const release = async () => {
                        await connection.close();
                    };

                    activeConnections.add(release);
                    browserSocket.once('close', () => {
                        void releaseConnection(release);
                    });
                    browserSocket.once('error', () => {
                        void releaseConnection(release);
                    });
                } catch (error) {
                    await transport?.close().catch(() => {});

                    if (
                        browserSocket.readyState === WebSocket.CONNECTING ||
                        browserSocket.readyState === WebSocket.OPEN
                    ) {
                        browserSocket.close(
                            1011,
                            error instanceof Error ? error.message : 'portal websocket connection failed',
                        );
                    }
                }
            })();
        });
    };

    server.on('upgrade', upgradeHandler);

    return {
        port: listeningPort,
        url: toUrl(host, listeningPort, portalPath),
        close: async () => {
            if (closed) {
                return;
            }

            closed = true;
            server.off('upgrade', upgradeHandler);
            wsServer.close();

            for (const release of activeConnections) {
                await releaseConnection(release);
            }

            await browserRuntime.close();

            await new Promise<void>((resolveServer) => {
                server.close(() => resolveServer());
            });
        },
    };
};

export const createPortalExampleRuntimeServer = async <TBrowserRuntime extends { close: () => Promise<void> }>(
    options: PortalExampleRuntimeServerOptions<TBrowserRuntime>,
): Promise<PortalExampleServer> => await createPortalExampleServerBase(options);

export const createPortalExampleServer = async <TBrowserRuntime extends { close: () => Promise<void> }>({
    host = '127.0.0.1',
    port = 0,
    portalPath = '/portal',
    indexHtmlPath,
    assetsDir,
    embeddedConfig,
    createBrowserRuntime,
    createBackend,
}: PortalExampleServerOptions<TBrowserRuntime>): Promise<PortalExampleServer> => {
    const shellHtml = await readFile(indexHtmlPath, 'utf8');

    return await createPortalExampleServerBase({
        configureApp: (app) => {
            app.get('/', (c) => c.html(injectPortalConfig(shellHtml, embeddedConfig)));
            app.get('/index.html', (c) => c.html(injectPortalConfig(shellHtml, embeddedConfig)));
            app.get('/assets/*', async (c) => readStaticFile(c.req.path, assetsDir));
        },
        createBackend,
        createBrowserRuntime,
        host,
        port,
        portalPath,
    });
};
