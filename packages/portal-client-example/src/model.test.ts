import { describe, expect, it } from 'vite-plus/test';

import {
    DEFAULT_RECENT_EVENT_TYPES,
    MAX_RECENT_EVENTS,
    appendPortalSentCommand,
    applyPortalEvent,
    getRecentEventTypeOptions,
    initialPortalDerivedState,
} from './model';

describe('applyPortalEvent', () => {
    it('exposes the default recent event type options and enriches them with discovered types', () => {
        expect(DEFAULT_RECENT_EVENT_TYPES).toEqual([
            'hello',
            'location.changed',
            'view.frame-meta',
            'command.result',
            'command.error',
            'app.pageState',
        ]);

        expect(
            getRecentEventTypeOptions([
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
                {
                    id: 'event-3',
                    summary: 'custom beta',
                    type: 'custom.beta',
                },
                {
                    id: 'event-4',
                    summary: 'custom alpha again',
                    type: 'custom.alpha',
                },
                {
                    id: 'event-5',
                    summary: 'command error',
                    type: 'command.error',
                },
            ]),
        ).toEqual([
            'hello',
            'location.changed',
            'view.frame-meta',
            'command.result',
            'command.error',
            'app.pageState',
            'custom.alpha',
            'custom.beta',
        ]);
    });

    it('captures hello and page state events', () => {
        const withHello = applyPortalEvent(initialPortalDerivedState, {
            capabilities: ['navigate.goto'],
            extensions: ['app.createPage'],
            protocolVersion: 1,
            type: 'hello',
        });
        const withPageState = applyPortalEvent(withHello, {
            payload: {
                hasPage: true,
            },
            type: 'app.pageState',
        });

        expect(withPageState.hello).toEqual({
            capabilities: ['navigate.goto'],
            extensions: ['app.createPage'],
            protocolVersion: 1,
        });
        expect(withPageState.pageState).toEqual({
            hasPage: true,
        });
    });

    it('captures command errors', () => {
        const nextState = applyPortalEvent(initialPortalDerivedState, {
            code: 'NO_ACTIVE_PAGE',
            message: 'No active page is available',
            requestId: 'req-1',
            type: 'command.error',
        });

        expect(nextState.latestError).toEqual({
            code: 'NO_ACTIVE_PAGE',
            message: 'No active page is available',
            requestId: 'req-1',
        });
    });

    it('captures sent commands in the recent log', () => {
        const nextEvents = appendPortalSentCommand(initialPortalDerivedState.recentEvents, {
            requestId: 'req-1',
            type: 'navigate.goto',
            url: 'https://example.com',
        });

        expect(nextEvents).toHaveLength(1);
        expect(nextEvents[0]).toEqual({
            direction: 'sent',
            id: expect.any(String),
            summary: 'https://example.com',
            type: 'navigate.goto',
        });
    });

    it('caps the recent event log', () => {
        let currentState = initialPortalDerivedState;

        for (let index = 0; index < MAX_RECENT_EVENTS + 3; index += 1) {
            currentState = applyPortalEvent(currentState, {
                index,
                type: `event-${index}`,
            });
        }

        expect(currentState.recentEvents).toHaveLength(MAX_RECENT_EVENTS);
        expect(currentState.recentEvents[0]?.type).toBe('event-3');
        expect(currentState.recentEvents.at(-1)?.type).toBe(`event-${MAX_RECENT_EVENTS + 2}`);
    });
});
