import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';

import type {
    PortalClientCommand,
    PortalCommandErrorEvent,
    PortalServerEvent,
    PortalTransport,
} from '@tarik02/portal-core';

export type PortalClientFrame = {
    frameId: string;
    format: 'jpeg';
    metadata?: unknown;
    payload: Uint8Array;
};

export type PortalClient = {
    readonly connectionState$: PortalTransport['status$'];
    readonly location$: Observable<string | null>;
    readonly frames$: Observable<PortalClientFrame>;
    readonly errors$: Observable<PortalCommandErrorEvent>;
    readonly events$: Observable<PortalServerEvent>;
    readonly sentCommands$: Observable<PortalClientCommand>;
    send: (command: PortalClientCommand) => Promise<unknown>;
    goto: (url: string) => Promise<void>;
    reload: () => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    click: (options: {
        x: number;
        y: number;
        button?: 'left' | 'middle' | 'right';
        clickCount?: number;
    }) => Promise<void>;
    type: (text: string) => Promise<void>;
    mouse: (command: Omit<Extract<PortalClientCommand, { type: 'input.mouse' }>, 'requestId'>) => Promise<void>;
    keyboard: (command: Omit<Extract<PortalClientCommand, { type: 'input.keyboard' }>, 'requestId'>) => Promise<void>;
    startView: () => Promise<void>;
    stopView: () => Promise<void>;
    close: () => Promise<void>;
};

export const createPortalClient = ({ transport }: { transport: PortalTransport }): PortalClient => {
    const location = new BehaviorSubject<string | null>(null);
    const frames = new Subject<PortalClientFrame>();
    const errors = new Subject<PortalCommandErrorEvent>();
    const events = new Subject<PortalServerEvent>();
    const sentCommands = new Subject<PortalClientCommand>();
    const frameMetadata = new Map<string, Extract<PortalServerEvent, { type: 'view.frame-meta' }>>();
    const pending = new Map<
        string,
        {
            resolve: (value: unknown) => void;
            reject: (error: Error) => void;
        }
    >();
    const subscription = new Subscription();

    subscription.add(
        transport.messages$.subscribe((packet) => {
            if (packet.kind === 'binary') {
                const metadata = frameMetadata.get(packet.frameId);
                if (!metadata) {
                    return;
                }

                frameMetadata.delete(packet.frameId);
                frames.next({
                    frameId: packet.frameId,
                    format: metadata.format,
                    metadata: metadata.metadata,
                    payload: Uint8Array.from(packet.payload),
                });
                return;
            }

            const event = packet.value as PortalServerEvent;
            events.next(event);

            if (event.type === 'location.changed' && 'url' in event) {
                location.next(event.url);
                return;
            }

            if (event.type === 'view.frame-meta' && 'frameId' in event) {
                frameMetadata.set(event.frameId, event);
                return;
            }

            if (event.type === 'command.result' && 'requestId' in event) {
                const pendingCommand = pending.get(event.requestId);
                if (!pendingCommand) {
                    return;
                }

                pending.delete(event.requestId);
                pendingCommand.resolve(event.payload);
                return;
            }

            if (event.type === 'command.error' && 'requestId' in event && 'code' in event && 'message' in event) {
                const pendingCommand = pending.get(event.requestId);
                if (pendingCommand) {
                    pending.delete(event.requestId);
                    pendingCommand.reject(new Error(`${event.code}: ${event.message}`));
                }

                errors.next(event);
            }
        }),
    );

    const send = (command: PortalClientCommand) =>
        new Promise<unknown>((resolve, reject) => {
            pending.set(command.requestId, { resolve, reject });
            sentCommands.next(command);
            void transport
                .send({
                    kind: 'json',
                    value: command,
                })
                .catch((error: unknown) => {
                    pending.delete(command.requestId);
                    reject(error instanceof Error ? error : new Error('failed to send portal command'));
                });
        });

    const withRequestId = <T extends Omit<PortalClientCommand, 'requestId'>>(command: T) =>
        send({
            ...command,
            requestId: globalThis.crypto.randomUUID(),
        });

    const close = async () => {
        subscription.unsubscribe();
        await transport.close();
        location.complete();
        frames.complete();
        errors.complete();
        events.complete();
        sentCommands.complete();
    };

    return {
        connectionState$: transport.status$,
        location$: location.asObservable(),
        frames$: frames.asObservable(),
        errors$: errors.asObservable(),
        events$: events.asObservable(),
        sentCommands$: sentCommands.asObservable(),
        send,
        goto: async (url) => {
            await withRequestId({
                type: 'navigate.goto',
                url,
            });
        },
        reload: async () => {
            await withRequestId({
                type: 'navigate.reload',
            });
        },
        goBack: async () => {
            await withRequestId({
                type: 'navigate.back',
            });
        },
        goForward: async () => {
            await withRequestId({
                type: 'navigate.forward',
            });
        },
        click: async (options) => {
            await withRequestId({
                type: 'input.click',
                ...options,
            });
        },
        type: async (text) => {
            await withRequestId({
                type: 'input.type',
                text,
            });
        },
        mouse: async (command) => {
            await withRequestId(command);
        },
        keyboard: async (command) => {
            await withRequestId(command);
        },
        startView: async () => {
            await withRequestId({
                type: 'view.start',
            });
        },
        stopView: async () => {
            await withRequestId({
                type: 'view.stop',
            });
        },
        close,
    };
};
