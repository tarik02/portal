import { BehaviorSubject, Subject } from 'rxjs';
import { type RawData, WebSocket } from 'ws';

import {
    createLengthPrefixedPacketCodec,
    type PortalPacket,
    type PortalTransport,
    type PortalTransportStatus,
} from '@tarik02/portal-core';

const toUint8Array = (value: RawData): Uint8Array => {
    if (value instanceof Uint8Array) {
        return Uint8Array.from(value);
    }

    if (typeof value === 'string') {
        return new TextEncoder().encode(value);
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    return Uint8Array.from(value);
};

export const createWebSocketServerTransport = (socket: WebSocket): PortalTransport => {
    const codec = createLengthPrefixedPacketCodec();
    const messages = new Subject<PortalPacket>();
    const status = new BehaviorSubject<PortalTransportStatus>(
        socket.readyState === WebSocket.OPEN ? 'open' : 'connecting',
    );

    const onMessage = (value: RawData) => {
        for (const packet of codec.decode(toUint8Array(value))) {
            messages.next(packet);
        }
    };

    const onOpen = () => {
        status.next('open');
    };

    const onClose = () => {
        status.next('closed');
        messages.complete();
        status.complete();
        socket.off('message', onMessage);
        socket.off('open', onOpen);
        socket.off('close', onClose);
    };

    socket.on('message', onMessage);
    socket.on('open', onOpen);
    socket.on('close', onClose);

    const waitForOpen = async () => {
        if (socket.readyState === WebSocket.OPEN) {
            return true;
        }

        if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
            return false;
        }

        return await new Promise<boolean>((resolve) => {
            const cleanup = () => {
                socket.off('open', onSocketOpen);
                socket.off('close', onSocketClose);
                socket.off('error', onSocketClose);
            };

            const onSocketOpen = () => {
                cleanup();
                resolve(true);
            };

            const onSocketClose = () => {
                cleanup();
                resolve(false);
            };

            socket.once('open', onSocketOpen);
            socket.once('close', onSocketClose);
            socket.once('error', onSocketClose);
        });
    };

    return {
        messages$: messages.asObservable(),
        status$: status.asObservable(),
        send: async (packet) => {
            const isOpen = await waitForOpen();
            if (!isOpen) {
                return;
            }

            socket.send(codec.encode(packet));
        },
        close: () => {
            socket.close();
            return Promise.resolve();
        },
    };
};
