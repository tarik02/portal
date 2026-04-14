import { describe, expect, it } from 'vite-plus/test';

import { createPortalDevProxyWebSocketUrl, createPortalWebSocketUrl, resolvePortalTransportUrl } from './portal-url';

describe('portal example url helpers', () => {
    it('converts http origins to ws urls', () => {
        expect(
            createPortalWebSocketUrl({
                baseUrl: 'http://localhost:3000',
                token: 'secret',
            }),
        ).toBe('ws://localhost:3000/portal?token=secret');
    });

    it('converts https origins to wss urls', () => {
        expect(
            createPortalWebSocketUrl({
                baseUrl: 'https://portal.example.com',
                token: 'secret',
            }),
        ).toBe('wss://portal.example.com/portal?token=secret');
    });

    it('accepts bare hosts in the portal input', () => {
        expect(
            createPortalWebSocketUrl({
                baseUrl: 'portal.example.com/root',
                token: 'secret',
            }),
        ).toBe('wss://portal.example.com/root/portal?token=secret');
    });

    it('resolves relative portal urls against the current origin', () => {
        expect(
            createPortalWebSocketUrl({
                baseUrl: '/portal',
                origin: 'http://localhost:5173',
                token: 'secret',
            }),
        ).toBe('ws://localhost:5173/portal?token=secret');
    });

    it('wraps websocket urls in a same-origin dev proxy when enabled', () => {
        expect(
            createPortalDevProxyWebSocketUrl({
                origin: 'http://localhost:5173',
                targetUrl: 'wss://portal.example.com/portal?token=secret',
            }),
        ).toBe('ws://localhost:5173/__portal-proxy?target=wss%3A%2F%2Fportal.example.com%2Fportal%3Ftoken%3Dsecret');
    });

    it('leaves websocket urls unchanged when proxying is disabled', () => {
        expect(
            resolvePortalTransportUrl({
                origin: 'http://localhost:5173',
                targetUrl: 'wss://portal.example.com/portal?token=secret',
                useProxy: false,
            }),
        ).toBe('wss://portal.example.com/portal?token=secret');
    });

    it('resolves relative websocket urls without the dev proxy', () => {
        expect(
            resolvePortalTransportUrl({
                origin: 'http://localhost:5173',
                targetUrl: '/portal',
                useProxy: true,
            }),
        ).toBe('ws://localhost:5173/portal');
    });
});
