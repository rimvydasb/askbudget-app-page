# askbudget-app-page

Front page of [askbudget.app](https://askbudget.app). A static page built with Vite.

| File          | Content                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `index.html`  | The page                                                                   |
| `styles.css`  | Tokens, the animated background, layout                                    |
| `flow.js`     | The data-flow diagram (edges, labels, particles), scroll reveal, copy button |
| `public/`     | Files copied as-is (`favicon.svg`)                                         |
| `scripts/deploy-r2.sh` | Uploads `dist/` to Cloudflare R2 with Wrangler                    |

```bash
npm install
npm run dev       # http://localhost:5173 with live reload
npm run build     # the site, into dist/
npm run preview   # serve dist/
```

## Deploy

`.github/workflows/deploy.yml` builds every push and pull request, and uploads `dist/` to R2 on a push to `main`.
Hashed files in `assets/` get a one-year cache; `index.html` and the rest get five minutes.

| GitHub setting                    | Kind     | Value                                                        |
| --------------------------------- | -------- | ------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`            | Secret   | An API token with **Workers R2 Storage: Edit**               |
| `R2_BUCKET`                       | Variable | The bucket name                                              |
| `CLOUDFLARE_ACCOUNT_ID`           | Variable | Optional; defaults to `b116b937f135479a90e8918fa9612552`     |

The deploy job runs in the `production` environment, so the secret and variables can live there or at repository level.
A manual deploy: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… R2_BUCKET=… npm run deploy`.

When a release ships, update the version (`0.1.0-rc.2`) and replace the disabled download buttons in `#get-started`.
