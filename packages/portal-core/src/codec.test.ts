import { describe, expect, it } from 'vite-plus/test';

import { createLengthPrefixedPacketCodec } from './codec';

describe('portal packet codec', () => {
    it('round-trips json and binary packets', () => {
        const codec = createLengthPrefixedPacketCodec();

        const encodedJson = codec.encode({
            kind: 'json',
            value: {
                requestId: 'req-1',
                type: 'navigate.reload',
            },
        });
        const encodedBinary = codec.encode({
            kind: 'binary',
            channel: 'view.frame',
            frameId: 'frame-1',
            payload: new Uint8Array([1, 2, 3]),
        });

        const decoded = [...codec.decode(encodedJson), ...codec.decode(encodedBinary)];

        expect(decoded).toEqual([
            {
                kind: 'json',
                value: {
                    requestId: 'req-1',
                    type: 'navigate.reload',
                },
            },
            {
                kind: 'binary',
                channel: 'view.frame',
                frameId: 'frame-1',
                payload: new Uint8Array([1, 2, 3]),
            },
        ]);
    });
});
