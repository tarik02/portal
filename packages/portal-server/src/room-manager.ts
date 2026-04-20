import { ReplaySubject, Subscription } from 'rxjs';

import { createPortalSessionHost, type PortalExtension, type PortalSessionHost } from './session-host';
import type { PortalBackend, PortalViewFrame, PortalViewSource } from './backend';
import type { PortalTransport } from '@tarik02/portal-core';

type ConnectionState = {
    readonly connectionId: string;
    readonly host: PortalSessionHost;
    readonly releaseView: () => Promise<void>;
};

export type PortalRoom = {
    readonly roomId: string;
};

type InternalPortalRoom = PortalRoom & {
    readonly backend: PortalBackend;
    readonly extensions: PortalExtension[];
    readonly connections: Map<string, ConnectionState>;
    readonly viewers: Map<string, ReplaySubject<PortalViewFrame>>;
    latestFrame: PortalViewFrame | null;
    sharedView: PortalViewSource | null;
    sharedViewSubscription: Subscription | null;
};

export type PortalRoomManager = {
    get(roomId: string): PortalRoom | undefined;
    attach(options: {
        roomId: string;
        transport: PortalTransport;
        createBackend: () => PortalBackend;
        createExtensions?: () => PortalExtension[];
    }): Promise<{
        close: () => Promise<void>;
    }>;
};

const cloneFrame = (frame: PortalViewFrame): PortalViewFrame => ({
    frameId: frame.frameId,
    format: frame.format,
    metadata: structuredClone(frame.metadata),
    payload: Uint8Array.from(frame.payload),
    ack: () => Promise.resolve(),
});

const maybeStopSharedView = async (room: InternalPortalRoom) => {
    if (room.viewers.size > 0 || room.sharedView === null) {
        return;
    }

    room.sharedViewSubscription?.unsubscribe();
    room.sharedViewSubscription = null;

    const current = room.sharedView;
    room.sharedView = null;
    room.latestFrame = null;
    await current.stop();
    await room.backend.stopView();
};

export const createPortalRoomManager = (): PortalRoomManager => {
    const rooms = new Map<string, InternalPortalRoom>();

    const ensureSharedView = async (room: InternalPortalRoom) => {
        if (room.sharedView !== null) {
            return;
        }

        room.sharedView = await room.backend.startView();
        room.sharedViewSubscription = room.sharedView.frames$.subscribe({
            next: (frame) => {
                room.latestFrame = cloneFrame(frame);

                for (const viewer of room.viewers.values()) {
                    viewer.next(cloneFrame(frame));
                }

                void frame.ack().catch(() => {});
            },
            error: () => {
                room.sharedViewSubscription?.unsubscribe();
                room.sharedViewSubscription = null;
                room.sharedView = null;
                room.latestFrame = null;
            },
            complete: () => {
                room.sharedViewSubscription?.unsubscribe();
                room.sharedViewSubscription = null;
                room.sharedView = null;
                room.latestFrame = null;
            },
        });
    };

    const maybeDeleteRoom = async (room: InternalPortalRoom) => {
        if (room.connections.size > 0) {
            return;
        }

        await maybeStopSharedView(room);
        rooms.delete(room.roomId);
    };

    const attach: PortalRoomManager['attach'] = ({ roomId, transport, createBackend, createExtensions }) => {
        let room = rooms.get(roomId);
        if (!room) {
            room = {
                roomId,
                backend: createBackend(),
                extensions: createExtensions?.() ?? [],
                connections: new Map(),
                viewers: new Map(),
                latestFrame: null,
                sharedView: null,
                sharedViewSubscription: null,
            };
            rooms.set(roomId, room);
        }

        const connectionId = globalThis.crypto.randomUUID();

        const releaseView = async () => {
            const viewer = room.viewers.get(connectionId);
            if (viewer) {
                viewer.complete();
                room.viewers.delete(connectionId);
            }

            await maybeStopSharedView(room);
        };

        const sharedBackend: PortalBackend = {
            location$: room.backend.location$,
            getLocation: () => room.backend.getLocation(),
            execute: (command) => room.backend.execute(command),
            startView: async () => {
                const existingViewer = room.viewers.get(connectionId);
                if (existingViewer) {
                    return {
                        frames$: existingViewer.asObservable(),
                        stop: releaseView,
                    };
                }

                const viewer = new ReplaySubject<PortalViewFrame>(1);
                room.viewers.set(connectionId, viewer);

                if (room.latestFrame) {
                    viewer.next(cloneFrame(room.latestFrame));
                }

                await ensureSharedView(room);

                return {
                    frames$: viewer.asObservable(),
                    stop: releaseView,
                };
            },
            stopView: releaseView,
        };

        const host = createPortalSessionHost({
            transport,
            backend: sharedBackend,
            extensions: room.extensions,
        });

        room.connections.set(connectionId, {
            connectionId,
            host,
            releaseView,
        });

        const close = async () => {
            const state = room.connections.get(connectionId);
            if (!state) {
                return;
            }

            room.connections.delete(connectionId);
            await state.releaseView();
            await state.host.close();
            await maybeDeleteRoom(room);
        };

        return Promise.resolve({ close });
    };

    return {
        get: (roomId) => rooms.get(roomId),
        attach,
    };
};

export const attachPortalConnection = ({
    roomManager,
    roomId,
    transport,
    createBackend,
    createExtensions,
}: {
    roomManager: PortalRoomManager;
    roomId: string;
    transport: PortalTransport;
    createBackend: () => PortalBackend;
    createExtensions?: () => PortalExtension[];
}) => roomManager.attach({ roomId, transport, createBackend, createExtensions });
