import { Observable, Subscription } from 'rxjs';

import {
    CORE_COMMAND_TYPES,
    isPortalClientCommand,
    isPortalCommandType,
    PORTAL_PROTOCOL_VERSION,
    type PortalCommandErrorEvent,
    type PortalClientCommand,
    type PortalExecutableCommand,
    type PortalExtensionEvent,
    type PortalTransport,
} from '@tarik02/portal-core';
import type { PortalViewSource } from './backend';
import { normalizePortalBackendError, type PortalBackend } from './backend';

export type PortalExtension = {
    events$?: Observable<PortalExtensionEvent>;
    commands?: Record<string, (payload: unknown) => Promise<unknown>>;
};

export type PortalSessionHost = {
    close: () => Promise<void>;
};

const toErrorEvent = ({
    requestId,
    error,
}: {
    requestId: string;
    error: unknown;
}): PortalCommandErrorEvent => {
    const normalized = normalizePortalBackendError(error);
    return {
        type: 'command.error',
        requestId,
        code: normalized.code,
        message: normalized.message,
    };
};

export const createPortalSessionHost = ({
    transport,
    backend,
    extensions = [],
}: {
    transport: PortalTransport;
    backend: PortalBackend;
    extensions?: PortalExtension[];
}): PortalSessionHost => {
    const subscriptions = new Subscription();
    let activeView: PortalViewSource | null = null;
    let activeViewSubscription: Subscription | null = null;

    const extensionNames = extensions.flatMap((extension) => Object.keys(extension.commands ?? {}));

    const stopView = async () => {
        activeViewSubscription?.unsubscribe();
        activeViewSubscription = null;

        if (activeView !== null) {
            const current = activeView;
            activeView = null;
            await current.stop();
        }

        await backend.stopView();
    };

    const startView = async () => {
        if (activeView !== null) {
            return;
        }

        activeView = await backend.startView();
        activeViewSubscription = activeView.frames$.subscribe({
            next: (frame) => {
                void transport.send({
                    kind: 'json',
                    value: {
                        type: 'view.frame-meta',
                        frameId: frame.frameId,
                        format: frame.format,
                        metadata: frame.metadata,
                    },
                });
                void transport.send({
                    kind: 'binary',
                    channel: 'view.frame',
                    frameId: frame.frameId,
                    payload: frame.payload,
                });
                void frame.ack().catch(() => {});
            },
        });
    };

    subscriptions.add(
        backend.location$.subscribe((url) => {
            void transport.send({
                kind: 'json',
                value: {
                    type: 'location.changed',
                    url,
                },
            });
        }),
    );

    for (const extension of extensions) {
        if (!extension.events$) {
            continue;
        }

        subscriptions.add(
            extension.events$.subscribe((event) => {
                void transport.send({
                    kind: 'json',
                    value: event,
                });
            }),
        );
    }

    subscriptions.add(
        transport.messages$.subscribe({
            next: (packet) => {
                if (packet.kind !== 'json' || !isPortalClientCommand(packet.value)) {
                    return;
                }

                const command = packet.value as PortalClientCommand;
                void (async () => {
                    try {
                        if (isPortalCommandType(command.type)) {
                            if (command.type === 'view.start') {
                                await startView();
                            } else if (command.type === 'view.stop') {
                                await stopView();
                            } else {
                                await backend.execute(command as PortalExecutableCommand);
                            }

                            await transport.send({
                                kind: 'json',
                                value: {
                                    type: 'command.result',
                                    requestId: command.requestId,
                                },
                            });
                            return;
                        }

                        for (const extension of extensions) {
                            const handler = extension.commands?.[command.type];
                            if (!handler) {
                                continue;
                            }

                            const payload = await handler(
                                (command as Extract<PortalClientCommand, { payload?: unknown }>).payload,
                            );
                            await transport.send({
                                kind: 'json',
                                value: {
                                    type: 'command.result',
                                    requestId: command.requestId,
                                    payload,
                                },
                            });
                            return;
                        }

                        await transport.send({
                            kind: 'json',
                            value: {
                                type: 'command.error',
                                requestId: command.requestId,
                                code: 'INVALID_COMMAND',
                                message: `Unknown portal command: ${command.type}`,
                            },
                        });
                    } catch (error) {
                        await transport.send({
                            kind: 'json',
                            value: toErrorEvent({
                                requestId: command.requestId,
                                error,
                            }),
                        });
                    }
                })();
            },
        }),
    );

    void transport.send({
        kind: 'json',
        value: {
            type: 'hello',
            protocolVersion: PORTAL_PROTOCOL_VERSION,
            capabilities: [...CORE_COMMAND_TYPES],
            extensions: extensionNames,
        },
    });

    return {
        close: async () => {
            subscriptions.unsubscribe();
            await stopView();
            await transport.close();
        },
    };
};
