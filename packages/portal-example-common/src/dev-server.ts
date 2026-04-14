import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import {
    type PortalBackend,
    attachPortalConnection,
    createPortalRoomManager,
    createWebSocketServerTransport,
} from '@tarik02/portal-server';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer as createViteServer, mergeConfig, type ViteDevServer } from 'vite';

import { portalClientViteBaseConfig } from './vite-dev-config';

export const PORTAL_PATH = '/portal';

export const readPort = (value: string | undefined, fallbackPort: number) => {
    if (value === undefined || value.trim() === '') {
        return fallbackPort;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : fallbackPort;
};

export const readHost = (value: string | undefined) => value?.trim() || '127.0.0.1';

export const runViteMiddleware = async (viteServer: ViteDevServer, req: IncomingMessage, res: ServerResponse) =>
    await new Promise<boolean>((resolve, reject) => {
        let settled = false;

        const finish = () => {
            if (settled) {
                return;
            }

            settled = true;
            resolve(true);
        };

        const next = (error?: unknown) => {
            if (settled) {
                return;
            }

            settled = true;
            res.off('finish', finish);

            if (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
                return;
            }

            resolve(false);
        };

        res.once('finish', finish);

        try {
            viteServer.middlewares(req, res, next);
        } catch (error) {
            res.off('finish', finish);
            reject(error);
        }
    });

export const createPortalUpgradeHandler = async <TBrowserRuntime extends { close: () => Promise<void> }>({
    createBackend,
    createBrowserRuntime,
    host,
}: {
    createBackend: (browserRuntime: TBrowserRuntime) => Promise<PortalBackend> | PortalBackend;
    createBrowserRuntime: () => Promise<TBrowserRuntime>;
    host: string;
}) => {
    const roomManager = createPortalRoomManager();
    const browserRuntime = await createBrowserRuntime();
    const wsServer = new WebSocketServer({ noServer: true });
    const activeConnections = new Set<() => Promise<void>>();
    let closed = false;

    const releaseConnection = async (release: () => Promise<void>) => {
        if (!activeConnections.delete(release)) {
            return;
        }

        await release();
    };

    const upgradeHandler = (
        request: IncomingMessage,
        socket: Parameters<typeof wsServer.handleUpgrade>[1],
        head: Buffer,
    ) => {
        const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
        if (requestUrl.pathname !== PORTAL_PATH) {
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

    return {
        close: async () => {
            if (closed) {
                return;
            }

            closed = true;
            wsServer.close();

            for (const release of activeConnections) {
                await releaseConnection(release);
            }

            await browserRuntime.close();
        },
        upgradeHandler,
    };
};

export const runPortalExampleDev = async <TBrowserRuntime extends { close: () => Promise<void> }>({
    name,
    defaultPort,
    shellHtml,
    root,
    createBackend,
    createBrowserRuntime,
}: {
    name: string;
    defaultPort: number;
    shellHtml: string;
    root: string;
    createBackend: (browserRuntime: TBrowserRuntime) => Promise<PortalBackend> | PortalBackend;
    createBrowserRuntime: () => Promise<TBrowserRuntime>;
}) => {
    const host = readHost(process.env.HOST);
    const port = readPort(process.env.PORT, defaultPort);
    const portal = await createPortalUpgradeHandler({
        createBackend: (browserRuntime) => createBackend(browserRuntime),
        createBrowserRuntime,
        host,
    });

    const httpServer = createHttpServer(async (request, response) => {
        if (!request.url) {
            response.statusCode = 404;
            response.end('not found');
            return;
        }

        const requestUrl = new URL(request.url, `http://${request.headers.host ?? host}`);
        if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
            const transformedHtml = await viteServer.transformIndexHtml(requestUrl.pathname, shellHtml);
            response.statusCode = 200;
            response.setHeader('content-type', 'text/html; charset=utf-8');
            response.end(transformedHtml);
            return;
        }

        const handled = await runViteMiddleware(viteServer, request, response);
        if (handled) {
            return;
        }

        response.statusCode = 404;
        response.end('not found');
    });

    const viteOptions = mergeConfig(portalClientViteBaseConfig, {
        configFile: false,
        appType: 'custom',
        clearScreen: false,
        root,
        server: {
            hmr: {
                server: httpServer,
            },
            middlewareMode: true,
        },
    });
    const viteServer = await createViteServer(viteOptions);

    httpServer.on('upgrade', portal.upgradeHandler);

    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => resolve());
    });

    const address = httpServer.address();
    if (address === null || typeof address === 'string') {
        throw new Error('portal example dev server is not listening');
    }

    const frontendUrl = new URL(`http://${host}:${address.port}/`);
    frontendUrl.searchParams.set('portalUrl', PORTAL_PATH);
    frontendUrl.searchParams.set('hidePortalInput', 'true');

    console.log(`${name} example dev ready: ${frontendUrl.toString()}`);
    console.log(`backend ready: ws://${host}:${address.port}${PORTAL_PATH}`);

    let closing = false;
    const shutdown = async () => {
        if (closing) {
            return;
        }

        closing = true;
        process.off('SIGINT', onSigint);
        process.off('SIGTERM', onSigterm);

        httpServer.off('upgrade', portal.upgradeHandler);
        await viteServer.close();
        await portal.close();

        await new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
        });
    };

    const onSigint = () => {
        void shutdown();
    };

    const onSigterm = () => {
        void shutdown();
    };

    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
};
