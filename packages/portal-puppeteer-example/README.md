# portal puppeteer example

## run

```bash
yarn exec puppeteer browsers install chrome
yarn workspace @tarik02/portal-client-example build
yarn workspace @tarik02/portal-puppeteer-example start
```

## notes

- the server serves the built `portal-client-example` dist output
- set `HOST` or `PORT` if you want a different bind address
