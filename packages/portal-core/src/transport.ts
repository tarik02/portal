import type { Observable } from 'rxjs';

import type { PortalBinaryPacket, PortalPacket } from './protocol';

export type PortalTransportStatus = 'connecting' | 'open' | 'closed';

export interface PortalTransport {
    readonly messages$: Observable<PortalPacket>;
    readonly status$: Observable<PortalTransportStatus>;
    send(packet: PortalPacket): Promise<void>;
    close(): Promise<void>;
}

export const clonePortalBinaryPacket = (packet: PortalBinaryPacket): PortalBinaryPacket => ({
    ...packet,
    payload: Uint8Array.from(packet.payload),
});

export const clonePortalPacket = (packet: PortalPacket): PortalPacket =>
    packet.kind === 'binary'
        ? clonePortalBinaryPacket(packet)
        : {
              kind: 'json',
              value: structuredClone(packet.value),
          };
