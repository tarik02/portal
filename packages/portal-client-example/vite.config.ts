import { mergeConfig } from 'vite-plus';

import { createPortalDevProxyPlugin } from '@tarik02/portal-example-common/vite-dev-proxy-plugin';
import { portalClientViteBaseConfig } from '@tarik02/portal-example-common/vite-dev-config';

export default mergeConfig(portalClientViteBaseConfig, {
    plugins: [createPortalDevProxyPlugin()],
});
