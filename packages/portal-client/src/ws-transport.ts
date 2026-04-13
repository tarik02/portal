import { BehaviorSubject, Subject } from 'rxjs';

import {
    createLengthPrefixedPacketCodec,
    type PortalPacket,
    type PortalTransport,
    type PortalTransportStatus,
} from '@tarik02/portal-core';

const toUint8Array = (value: ArrayBuffer | Blob | Uint8Array) => {
    if (value instanceof Uint8Array) {
        return Uint8Array.from(value);
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    throw new Error('blob websocket payloads are not supported by the portal client');
};

export const createWebSocketPortalTransport = (input: string | WebSocket): PortalTransport => {
    const socket = typeof input === 'string' ? new WebSocket(input) : input;
    socket.binaryType = 'arraybuffer';

    const codec = createLengthPrefixedPacketCodec();
    const messages = new Subject<PortalPacket>();
    const status = new BehaviorSubject<PortalTransportStatus>(
        socket.readyState === socket.OPEN ? 'open' : 'connecting',
    );

    const onOpen = () => {
        status.next('open');
    };

    const onMessage = (event: MessageEvent<ArrayBuffer | Blob>) => {
        const data = event.data;
        if (data instanceof Blob) {
            void data.arrayBuffer().then((buffer) => {
                for (const packet of codec.decode(new Uint8Array(buffer))) {
                    messages.next(packet);
                }
            });
            return;
        }

        for (const packet of codec.decode(toUint8Array(data))) {
            messages.next(packet);
        }
    };

    const onClose = () => {
        status.next('closed');
        messages.complete();
        status.complete();
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('message', onMessage as EventListener);
        socket.removeEventListener('close', onClose);
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage as EventListener);
    socket.addEventListener('close', onClose);

    return {
        messages$: messages.asObservable(),
        status$: status.asObservable(),
        send: async (packet) => {
            socket.send(codec.encode(packet) as unknown as BufferSource);
        },
        close: async () => {
            socket.close();
        },
    };
};
