type PortalConnectionConfig = {
    portalUrl: string;
    hidePortalInput: boolean;
};

const readSearchParam = (params: URLSearchParams, name: string) => params.get(name)?.trim() ?? '';

const readBooleanSearchParam = (params: URLSearchParams, name: string) => {
    const value = readSearchParam(params, name).toLowerCase();

    return value === '1' || value === 'true' || value === 'yes';
};

const readWindowConfig = () => globalThis.window?.__PORTAL_CLIENT_EXAMPLE_CONFIG__ ?? {};

const readConfiguredPortalUrl = (params: URLSearchParams) => {
    const injectedPortalUrl = readWindowConfig().portalUrl?.trim() ?? '';
    if (injectedPortalUrl !== '') {
        return injectedPortalUrl;
    }

    const directUrl =
        readSearchParam(params, 'url') ||
        readSearchParam(params, 'portalUrl') ||
        import.meta.env.VITE_PORTAL_URL?.trim() ||
        '';

    if (directUrl !== '') {
        return directUrl;
    }

    const legacyBaseUrl = readSearchParam(params, 'baseUrl');
    if (legacyBaseUrl.startsWith('ws://') || legacyBaseUrl.startsWith('wss://')) {
        return legacyBaseUrl;
    }

    return '';
};

const readConfiguredHidePortalInput = (params: URLSearchParams) => {
    const injectedHidePortalInput = readWindowConfig().hidePortalInput;
    if (typeof injectedHidePortalInput === 'boolean') {
        return injectedHidePortalInput;
    }

    const queryValue = readSearchParam(params, 'hidePortalInput');
    if (queryValue !== '') {
        return readBooleanSearchParam(params, 'hidePortalInput');
    }

    const envValue = import.meta.env.VITE_PORTAL_HIDE_PORTAL_INPUT?.trim().toLowerCase();
    if (envValue === '1' || envValue === 'true' || envValue === 'yes') {
        return true;
    }

    return false;
};

export const readPortalConnectionConfig = (): PortalConnectionConfig => {
    const params = new URLSearchParams(globalThis.location.search);

    return {
        hidePortalInput: readConfiguredHidePortalInput(params),
        portalUrl: readConfiguredPortalUrl(params),
    };
};
