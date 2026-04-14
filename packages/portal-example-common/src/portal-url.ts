const normalizeBasePath = (pathname: string) => {
    if (pathname === '/') {
        return '';
    }

    return pathname.replace(/\/+$/, '');
};

const hasUrlProtocol = (value: string) => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);

const isRelativeUrl = (value: string) => /^[./]/.test(value);

const normalizePortalBaseUrl = (value: string) => {
    const trimmed = value.trim();

    if (hasUrlProtocol(trimmed) || isRelativeUrl(trimmed)) {
        return trimmed;
    }

    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(trimmed) ? `http://${trimmed}` : `https://${trimmed}`;
};

export const PORTAL_DEV_PROXY_PATH = '/__portal-proxy';

export const createPortalWebSocketUrl = ({
    baseUrl,
    origin = globalThis.location?.origin ?? 'http://localhost',
    token,
}: {
    baseUrl: string;
    origin?: string;
    token?: string;
}) => {
    const normalizedBaseUrl = normalizePortalBaseUrl(baseUrl);

    if (isRelativeUrl(normalizedBaseUrl)) {
        const url = new URL(normalizedBaseUrl, origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.search = '';
        url.hash = '';

        if (token) {
            url.searchParams.set('token', token);
        }

        return url.toString();
    }

    const url = new URL(normalizedBaseUrl);

    switch (url.protocol) {
        case 'http:': {
            url.protocol = 'ws:';
            break;
        }
        case 'https:': {
            url.protocol = 'wss:';
            break;
        }
        case 'ws:':
        case 'wss:': {
            break;
        }
        default: {
            throw new Error(`Unsupported portal base URL protocol: ${url.protocol}`);
        }
    }

    url.pathname = `${normalizeBasePath(url.pathname)}/portal`;
    url.search = '';
    url.hash = '';

    if (token) {
        url.searchParams.set('token', token);
    }

    return url.toString();
};

export const createPortalDevProxyWebSocketUrl = ({ origin, targetUrl }: { origin: string; targetUrl: string }) => {
    const url = new URL(PORTAL_DEV_PROXY_PATH, origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('target', targetUrl);

    return url.toString();
};

export const resolvePortalTransportUrl = ({
    origin,
    targetUrl,
    useProxy,
}: {
    origin: string;
    targetUrl: string;
    useProxy: boolean;
}) => {
    if (isRelativeUrl(targetUrl)) {
        return createPortalWebSocketUrl({
            baseUrl: targetUrl,
            origin,
        });
    }

    return useProxy ? createPortalDevProxyWebSocketUrl({ origin, targetUrl }) : targetUrl;
};
