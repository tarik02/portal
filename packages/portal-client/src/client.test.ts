import { describe, expect, it } from 'vite-plus/test';

import { createMemoryPortalTransportPair } from '@tarik02/portal-core';

import { createPortalClient } from './client';

describe('portal client', () => {
    it('correlates command results and pairs frame metadata with payloads', async () => {
        const [serverTransport, clientTransport] = createMemoryPortalTransportPair();
        const client = createPortalClient({
            transport: clientTransport,
        });
        const frames: number[][] = [];
        let requestId = '';

        client.frames$.subscribe((frame) => {
            frames.push([...frame.payload]);
        });

        const commandPromise = new Promise<void>((resolve, reject) => {
            const subscription = serverTransport.messages$.subscribe((packet) => {
                if (packet.kind !== 'json' || !('requestId' in packet.value)) {
                    return;
                }

                requestId = packet.value.requestId;
                subscription.unsubscribe();
                void serverTransport
                    .send({
                        kind: 'json',
                        value: {
                            type: 'command.result',
                            requestId,
                        },
                    })
                    .then(() => resolve())
                    .catch(reject);
            });

            void client.reload().catch(reject);
        });
        await commandPromise;

        await serverTransport.send({
            kind: 'json',
            value: {
                type: 'view.frame-meta',
                frameId: 'frame-1',
                format: 'jpeg',
                metadata: {
                    width: 1,
                    height: 1,
                },
            },
        });
        await serverTransport.send({
            kind: 'binary',
            channel: 'view.frame',
            frameId: 'frame-1',
            payload: new Uint8Array([1, 2, 3]),
        });

        await Promise.resolve();

        expect(requestId).not.toBe('');
        expect(frames).toEqual([[1, 2, 3]]);

        await client.close();
    });
});
