import { describe, expect, it, vi } from 'vite-plus/test';
import { EMPTY, Subject } from 'rxjs';

import { createMemoryPortalTransportPair } from '@tarik02/portal-core';

import type { PortalViewFrame } from './backend';
import { attachPortalConnection, createPortalRoomManager } from './room-manager';

const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('portal room manager', () => {
    it('shares a single view producer across multiple connections', async () => {
        const roomManager = createPortalRoomManager();
        const [clientTransportA, serverTransportA] = createMemoryPortalTransportPair();
        const [clientTransportB, serverTransportB] = createMemoryPortalTransportPair();
        const frames = new Subject<PortalViewFrame>();
        const startView = vi.fn(async () => ({
            frames$: frames.asObservable(),
            stop: async () => {},
        }));

        const receivedA: string[] = [];
        const receivedB: string[] = [];

        clientTransportA.messages$.subscribe((packet) => {
            if (packet.kind === 'json' && 'type' in packet.value) {
                receivedA.push(packet.value.type);
            }
        });
        clientTransportB.messages$.subscribe((packet) => {
            if (packet.kind === 'json' && 'type' in packet.value) {
                receivedB.push(packet.value.type);
            }
        });

        const connectionA = await attachPortalConnection({
            roomManager,
            roomId: 'worker-1',
            transport: serverTransportA,
            createBackend: () => ({
                location$: EMPTY,
                execute: async () => {},
                startView,
                stopView: async () => {},
            }),
        });
        const connectionB = await attachPortalConnection({
            roomManager,
            roomId: 'worker-1',
            transport: serverTransportB,
            createBackend: () => ({
                location$: EMPTY,
                execute: async () => {},
                startView,
                stopView: async () => {},
            }),
        });

        await clientTransportA.send({
            kind: 'json',
            value: {
                requestId: 'view-a',
                type: 'view.start',
            },
        });
        await clientTransportB.send({
            kind: 'json',
            value: {
                requestId: 'view-b',
                type: 'view.start',
            },
        });

        await tick();

        frames.next({
            frameId: 'frame-1',
            format: 'jpeg',
            metadata: { width: 1, height: 1 },
            payload: new Uint8Array([7, 8, 9]),
            ack: async () => {},
        });

        await tick();

        expect(startView).toHaveBeenCalledTimes(1);
        expect(receivedA).toContain('view.frame-meta');
        expect(receivedB).toContain('view.frame-meta');

        await connectionA.close();
        await connectionB.close();
    });
});
