# portal e2e

## build dependencies

Build the client example and its workspace dependencies before running the E2E suite:

```bash
yarn turbo run build --filter=@tarik02/portal-client-example...
```

## run playwright backend e2e

Start the Playwright example server:

```bash
PORT=41006 yarn workspace @tarik02/portal-playwright-example run start
```

In another shell, run the Playwright-backed e2e suite:

```bash
yarn workspace @tarik02/portal-e2e run e2e:playwright
```

## run puppeteer backend e2e

Start the Puppeteer example server:

```bash
PORT=41007 yarn workspace @tarik02/portal-puppeteer-example run start
```

In another shell, run the Puppeteer-backed e2e suite:

```bash
yarn workspace @tarik02/portal-e2e run e2e:puppeteer
```
