# portal playwright example

## run

```bash
yarn playwright install chromium
yarn workspace @tarik02/portal-client-example build
yarn workspace @tarik02/portal-playwright-example start
```

## notes

- the server serves the built `portal-client-example` dist output
- set `HOST` or `PORT` if you want a different bind address
