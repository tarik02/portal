import { BehaviorSubject, Subject } from 'rxjs';

import type { PortalTransport } from './transport';
import { clonePortalPacket } from './transport';

export const createMemoryPortalTransportPair = (): readonly [PortalTransport, PortalTransport] => {
    const leftMessages = new Subject<ReturnType<typeof clonePortalPacket>>();
    const rightMessages = new Subject<ReturnType<typeof clonePortalPacket>>();
    const leftStatus = new BehaviorSubject<'open' | 'closed'>('open');
    const rightStatus = new BehaviorSubject<'open' | 'closed'>('open');

    const closeBoth = async () => {
        if (leftStatus.value === 'closed' && rightStatus.value === 'closed') {
            return;
        }

        leftStatus.next('closed');
        rightStatus.next('closed');
        leftMessages.complete();
        rightMessages.complete();
        leftStatus.complete();
        rightStatus.complete();
    };

    const left: PortalTransport = {
        messages$: leftMessages.asObservable(),
        status$: leftStatus.asObservable(),
        send: async (packet) => {
            rightMessages.next(clonePortalPacket(packet));
        },
        close: closeBoth,
    };

    const right: PortalTransport = {
        messages$: rightMessages.asObservable(),
        status$: rightStatus.asObservable(),
        send: async (packet) => {
            leftMessages.next(clonePortalPacket(packet));
        },
        close: closeBoth,
    };

    return [left, right] as const;
};
