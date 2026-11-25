# Extension (Chrome Store)

WXT MV3 build with Google sign-in + Veeqo OAuth Bearer tokens.

See the parent [README](../README.md) for Worker, Veeqo OAuth, and Store setup.

```bash
npm install
npm test         # unit tests (auth + label helpers)
npm run dev      # unpacked
npm run build
npm run zip      # Chrome Web Store package
```

Before packaging, set `GOOGLE_OAUTH_CLIENT_ID` in `wxt.config.ts` and point the popup **Auth Worker URL** at your deployed Worker.

See the parent [README — Tests](../README.md#tests) for the full suite (Worker + extension).
