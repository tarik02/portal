import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import type { Plugin, ViteDevServer } from 'vite';
import WebSocket, { WebSocketServer, type RawData } from 'ws';

import { PORTAL_DEV_PROXY_PATH } from './portal-url.ts';

export const createPortalDevProxyPlugin = (): Plugin => ({
    configureServer(server: Pick<ViteDevServer, 'httpServer'>) {
        const httpServer = server.httpServer;
        if (!httpServer) {
            return;
        }

        const proxyServer = new WebSocketServer({ noServer: true });

        const upgradeHandler = (request: IncomingMessage, socket: Socket, head: Buffer) => {
            const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
            if (requestUrl.pathname !== PORTAL_DEV_PROXY_PATH) {
                return;
            }

            const targetUrl = requestUrl.searchParams.get('target');
            if (!targetUrl) {
                socket.destroy();
                return;
            }

            proxyServer.handleUpgrade(request, socket, head, (browserSocket) => {
                let closed = false;
                let remoteSocket: WebSocket | null = null;
                const queuedMessages: Array<{ data: RawData; isBinary: boolean }> = [];

                try {
                    remoteSocket = new WebSocket(targetUrl);
                } catch {
                    browserSocket.close(1011, 'invalid target url');
                    return;
                }

                const finish = () => {
                    if (closed) {
                        return;
                    }

                    closed = true;

                    if (
                        remoteSocket &&
                        (remoteSocket.readyState === WebSocket.CONNECTING || remoteSocket.readyState === WebSocket.OPEN)
                    ) {
                        remoteSocket.terminate();
                    }

                    if (
                        browserSocket.readyState === WebSocket.CONNECTING ||
                        browserSocket.readyState === WebSocket.OPEN
                    ) {
                        browserSocket.terminate();
                    }
                };

                browserSocket.on('message', (data, isBinary) => {
                    if (remoteSocket?.readyState === WebSocket.OPEN) {
                        remoteSocket.send(data, { binary: isBinary });
                        return;
                    }

                    queuedMessages.push({ data, isBinary });
                });

                browserSocket.on('close', () => {
                    finish();
                });

                browserSocket.on('error', () => {
                    finish();
                });

                remoteSocket.on('open', () => {
                    if (!remoteSocket) {
                        return;
                    }

                    for (const message of queuedMessages) {
                        remoteSocket.send(message.data, { binary: message.isBinary });
                    }

                    queuedMessages.length = 0;
                });

                remoteSocket.on('message', (data, isBinary) => {
                    if (browserSocket.readyState === WebSocket.OPEN) {
                        browserSocket.send(data, { binary: isBinary });
                    }
                });

                remoteSocket.on('close', () => {
                    finish();
                });

                remoteSocket.on('error', () => {
                    finish();
                });
            });
        };

        httpServer.on('upgrade', upgradeHandler);
        httpServer.once('close', () => {
            httpServer.off('upgrade', upgradeHandler);
            void proxyServer.close();
        });
    },
    name: 'portal-dev-proxy',
});
