import type { PortalPacket } from './protocol';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const JSON_PACKET_TAG = 1;
const BINARY_PACKET_TAG = 2;

const toUint32 = (value: number) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value);
    return bytes;
};

const readUint32 = (bytes: Uint8Array, offset: number) =>
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset);

const concatBytes = (left: Uint8Array, right: Uint8Array) => {
    const merged = new Uint8Array(left.length + right.length);
    merged.set(left, 0);
    merged.set(right, left.length);
    return merged;
};

export const createLengthPrefixedPacketCodec = () => {
    let buffer = new Uint8Array(0);

    const encode = (packet: PortalPacket): Uint8Array => {
        if (packet.kind === 'json') {
            const payload = encoder.encode(JSON.stringify(packet.value));
            const out = new Uint8Array(1 + 4 + payload.length);
            out[0] = JSON_PACKET_TAG;
            out.set(toUint32(payload.length), 1);
            out.set(payload, 5);
            return out;
        }

        const frameId = encoder.encode(packet.frameId);
        const out = new Uint8Array(1 + 4 + frameId.length + 4 + packet.payload.length);
        out[0] = BINARY_PACKET_TAG;
        out.set(toUint32(frameId.length), 1);
        out.set(frameId, 5);
        out.set(toUint32(packet.payload.length), 5 + frameId.length);
        out.set(packet.payload, 9 + frameId.length);
        return out;
    };

    const decode = (chunk: Uint8Array): PortalPacket[] => {
        buffer = concatBytes(buffer, chunk);
        const packets: PortalPacket[] = [];

        while (buffer.length > 0) {
            const tag = buffer[0];

            if (tag === JSON_PACKET_TAG) {
                if (buffer.length < 5) {
                    break;
                }

                const payloadLength = readUint32(buffer, 1);
                const packetLength = 5 + payloadLength;
                if (buffer.length < packetLength) {
                    break;
                }

                const payload = decoder.decode(buffer.subarray(5, packetLength));
                packets.push({
                    kind: 'json',
                    value: JSON.parse(payload) as PortalPacket['kind'] extends never ? never : never,
                } as PortalPacket);
                buffer = buffer.subarray(packetLength);
                continue;
            }

            if (tag === BINARY_PACKET_TAG) {
                if (buffer.length < 5) {
                    break;
                }

                const frameIdLength = readUint32(buffer, 1);
                const dataLengthOffset = 5 + frameIdLength;
                if (buffer.length < dataLengthOffset + 4) {
                    break;
                }

                const payloadLength = readUint32(buffer, dataLengthOffset);
                const packetLength = dataLengthOffset + 4 + payloadLength;
                if (buffer.length < packetLength) {
                    break;
                }

                const frameId = decoder.decode(buffer.subarray(5, 5 + frameIdLength));
                packets.push({
                    kind: 'binary',
                    channel: 'view.frame',
                    frameId,
                    payload: Uint8Array.from(buffer.subarray(dataLengthOffset + 4, packetLength)),
                });
                buffer = buffer.subarray(packetLength);
                continue;
            }

            throw new Error(`unsupported portal packet tag: ${String(tag)}`);
        }

        return packets;
    };

    return {
        encode,
        decode,
    };
};
