import { useEffect, useRef, useState } from 'react';
import { Subscription } from 'rxjs';

import {
    createPortalClient,
    createWebSocketPortalTransport,
    type PortalClient,
    type PortalClientFrame,
} from '@tarik02/portal-client';

import {
    applyPortalEvent,
    appendPortalSentCommand,
    readCommandErrorEvent,
    readHelloEvent,
    type PortalCommandErrorState,
    type PortalConnectionState,
    type PortalDerivedState,
    type PortalHelloState,
    type PortalPageState,
    type PortalRecentEvent,
} from './model';
import { createPortalWebSocketUrl, resolvePortalTransportUrl } from '@tarik02/portal-example-common/portal-url';

export type PortalSessionSnapshot = {
    connectionIssue: string | null;
    connectionState: PortalConnectionState;
    frame: PortalClientFrame | null;
    hello: PortalHelloState | null;
    latestError: PortalCommandErrorState | null;
    location: string | null;
    pageState: PortalPageState | null;
    recentEvents: PortalRecentEvent[];
};

export type UsePortalSessionResult = PortalSessionSnapshot & {
    click: (options: {
        x: number;
        y: number;
        button?: 'left' | 'middle' | 'right';
        clickCount?: number;
    }) => Promise<void>;
    connect: (webSocketUrl: string) => Promise<void>;
    disconnect: () => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    initialize: (options: { baseUrl: string; token: string }) => Promise<void>;
    goto: (url: string) => Promise<void>;
    keyboard: (command: Parameters<PortalClient['keyboard']>[0]) => Promise<void>;
    mouse: (command: Parameters<PortalClient['mouse']>[0]) => Promise<void>;
    reload: () => Promise<void>;
    startView: () => Promise<void>;
    stopView: () => Promise<void>;
    type: (text: string) => Promise<void>;
};

export type PortalSessionHook = () => UsePortalSessionResult;

const createInitialSnapshot = (): PortalSessionSnapshot => ({
    connectionIssue: null,
    connectionState: 'closed',
    frame: null,
    hello: null,
    latestError: null,
    location: null,
    pageState: null,
    recentEvents: [],
});

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'portal connection failed');

const waitForHello = (client: PortalClient) =>
    new Promise<void>((resolve, reject) => {
        const subscription = new Subscription();
        const timeout = globalThis.setTimeout(() => {
            subscription.unsubscribe();
            reject(new Error('Timed out waiting for portal hello event'));
        }, 2000);

        const finish = (callback: () => void) => {
            clearTimeout(timeout);
            subscription.unsubscribe();
            callback();
        };

        subscription.add(
            client.events$.subscribe((event) => {
                if (!readHelloEvent(event)) {
                    return;
                }

                finish(resolve);
            }),
        );

        subscription.add(
            client.connectionState$.subscribe((state) => {
                if (state !== 'closed') {
                    return;
                }

                finish(() => reject(new Error('Portal connection closed before the session became ready')));
            }),
        );
    });

export const usePortalSession: PortalSessionHook = () => {
    const [snapshot, setSnapshot] = useState<PortalSessionSnapshot>(createInitialSnapshot);
    const attemptRef = useRef(0);
    const clientRef = useRef<PortalClient | null>(null);
    const cleanupRef = useRef<(() => Promise<void>) | null>(null);
    const disconnectRef = useRef<() => Promise<void>>(async () => {});

    disconnectRef.current = async () => {
        attemptRef.current += 1;

        const cleanup = cleanupRef.current;
        cleanupRef.current = null;
        clientRef.current = null;

        if (cleanup) {
            await cleanup();
        }
    };

    useEffect(
        () => () => {
            void disconnectRef.current();
        },
        [],
    );

    const connectWebSocketUrl = async (webSocketUrl: string) => {
        await disconnectRef.current();

        const attemptId = attemptRef.current;
        setSnapshot({
            ...createInitialSnapshot(),
            connectionState: 'connecting',
        });

        try {
            const client = createPortalClient({
                transport: createWebSocketPortalTransport(
                    resolvePortalTransportUrl({
                        origin: window.location.origin,
                        targetUrl: webSocketUrl.trim(),
                        useProxy: import.meta.env.DEV,
                    }),
                ),
            });
            const subscription = new Subscription();
            const updateIfActive = (updater: (current: PortalSessionSnapshot) => PortalSessionSnapshot) => {
                if (attemptRef.current !== attemptId) {
                    return;
                }

                setSnapshot(updater);
            };

            subscription.add(
                client.connectionState$.subscribe((connectionState) => {
                    updateIfActive((current) => ({
                        ...current,
                        connectionState,
                    }));
                }),
            );

            subscription.add(
                client.location$.subscribe((location) => {
                    updateIfActive((current) => ({
                        ...current,
                        location,
                    }));
                }),
            );

            subscription.add(
                client.frames$.subscribe((frame) => {
                    updateIfActive((current) => ({
                        ...current,
                        frame,
                    }));
                }),
            );

            subscription.add(
                client.errors$.subscribe((error) => {
                    const latestError = readCommandErrorEvent(error);

                    updateIfActive((current) => ({
                        ...current,
                        latestError: latestError ?? current.latestError,
                    }));
                }),
            );

            subscription.add(
                client.events$.subscribe((event) => {
                    updateIfActive((current) => {
                        const nextDerivedState: PortalDerivedState = applyPortalEvent(
                            {
                                hello: current.hello,
                                latestError: current.latestError,
                                pageState: current.pageState,
                                recentEvents: current.recentEvents,
                            },
                            event,
                        );

                        return {
                            ...current,
                            ...nextDerivedState,
                        };
                    });
                }),
            );

            subscription.add(
                client.sentCommands$.subscribe((command) => {
                    updateIfActive((current) => ({
                        ...current,
                        recentEvents: appendPortalSentCommand(current.recentEvents, command),
                    }));
                }),
            );

            cleanupRef.current = async () => {
                subscription.unsubscribe();
                await client.close();
            };
            clientRef.current = client;

            await waitForHello(client);

            updateIfActive((current) => ({
                ...current,
                connectionIssue: null,
            }));
        } catch (error) {
            await disconnectRef.current();
            setSnapshot({
                ...createInitialSnapshot(),
                connectionIssue: toErrorMessage(error),
            });
        }
    };

    const connect: UsePortalSessionResult['connect'] = async (webSocketUrl) => {
        await connectWebSocketUrl(webSocketUrl);
        await bootstrapViewStream();
    };

    const disconnect: UsePortalSessionResult['disconnect'] = async () => {
        await disconnectRef.current();
        setSnapshot(createInitialSnapshot());
    };

    const runCommand = async (operation: (client: PortalClient) => Promise<void>) => {
        const client = clientRef.current;
        if (!client) {
            setSnapshot((current) => ({
                ...current,
                connectionIssue: 'Portal client is not connected',
            }));
            return;
        }

        try {
            await operation(client);
            setSnapshot((current) => ({
                ...current,
                connectionIssue: null,
            }));
        } catch (error) {
            setSnapshot((current) => ({
                ...current,
                connectionIssue: toErrorMessage(error),
            }));
        }
    };

    const bootstrapViewStream = async () => {
        await runCommand(async (client) => {
            await client.startView();
        });
    };

    return {
        ...snapshot,
        click: async (options) => {
            await runCommand(async (client) => {
                await client.click(options);
            });
        },
        connect,
        disconnect,
        goBack: async () => {
            await runCommand(async (client) => {
                await client.goBack();
            });
        },
        goForward: async () => {
            await runCommand(async (client) => {
                await client.goForward();
            });
        },
        initialize: async (options) => {
            await connect(
                createPortalWebSocketUrl({
                    baseUrl: options.baseUrl,
                    origin: window.location.origin,
                    token: options.token,
                }),
            );
        },
        goto: async (url) => {
            await runCommand(async (client) => {
                await client.goto(url);
            });
        },
        keyboard: async (command) => {
            await runCommand(async (client) => {
                await client.keyboard(command);
            });
        },
        mouse: async (command) => {
            await runCommand(async (client) => {
                await client.mouse(command);
            });
        },
        reload: async () => {
            await runCommand(async (client) => {
                await client.reload();
            });
        },
        startView: async () => {
            await runCommand(async (client) => {
                await client.startView();
            });
        },
        stopView: async () => {
            await runCommand(async (client) => {
                await client.stopView();
            });
        },
        type: async (text) => {
            await runCommand(async (client) => {
                await client.type(text);
            });
        },
    };
};
