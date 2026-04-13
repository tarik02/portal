import { BehaviorSubject, Subject } from 'rxjs';

import { clonePortalPacket, type PortalTransport } from './transport';

export const createMemoryPortalTransportPair = (): readonly [PortalTransport, PortalTransport] => {
    const leftMessages = new Subject<ReturnType<typeof clonePortalPacket>>();
    const rightMessages = new Subject<ReturnType<typeof clonePortalPacket>>();
    const leftStatus = new BehaviorSubject<'open' | 'closed'>('open');
    const rightStatus = new BehaviorSubject<'open' | 'closed'>('open');

    const closeBoth = () => {
        if (leftStatus.value === 'closed' && rightStatus.value === 'closed') {
            return Promise.resolve();
        }

        leftStatus.next('closed');
        rightStatus.next('closed');
        leftMessages.complete();
        rightMessages.complete();
        leftStatus.complete();
        rightStatus.complete();
        return Promise.resolve();
    };

    const left: PortalTransport = {
        messages$: leftMessages.asObservable(),
        status$: leftStatus.asObservable(),
        send: (packet) => {
            rightMessages.next(clonePortalPacket(packet));
            return Promise.resolve();
        },
        close: closeBoth,
    };

    const right: PortalTransport = {
        messages$: rightMessages.asObservable(),
        status$: rightStatus.asObservable(),
        send: (packet) => {
            leftMessages.next(clonePortalPacket(packet));
            return Promise.resolve();
        },
        close: closeBoth,
    };

    return [left, right] as const;
};
