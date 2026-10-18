# Deploying vishnu.rengaraj.com

The site is a static build. `npm run build` prerenders every route to HTML in `dist/`, so the writing is on the page before JavaScript runs. The Pi does not need Node after `dist/` is copied over.

The public site is `https://vishnu.rengaraj.com`. `rengaraj.com` and `www.rengaraj.com` redirect there and keep the path. GitHub Pages is still what the apex serves until the tunnel is cut over. Root `CNAME` stays `rengaraj.com` for that. Merging this branch replaces the old prebuilt Pages files with source, so Pages will stop serving a working site. Point DNS at the Pi first, or merge only when you are ready.

## Build

```bash
npm ci
npm run build
```

`dist/` contains `index.html`, one HTML file per route (`about.html`, `resume/education.html`, and so on), hashed JS and CSS under `static/`, images and video under `media/`, and PDFs under `assets/`.

## Cloudflare Web Analytics

The beacon is optional. Create the site in Cloudflare Web Analytics, copy the token, and export it before building:

```bash
# .env is gitignored. See .env.example.
echo 'VITE_CF_BEACON_TOKEN=your_token_here' > .env
npm run build
```

`scripts/deploy.sh` runs that build, so a `.env` or an exported `VITE_CF_BEACON_TOKEN` on the machine that builds is enough. If the variable is unset, the script tag is left out and the page makes no third-party requests. Do not commit the token.

## Copy to the Pi

```bash
cp deploy.env.example deploy.env
# edit DEPLOY_HOST and DEPLOY_PATH
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The Pi user needs write access to `DEPLOY_PATH` (for example `/var/www/rengaraj`) and `rsync` on both sides.

## nginx

`deploy/nginx.conf` listens on `127.0.0.1:80` and chooses a site from the `Host` header, which is what the tunnel sends:

- `vishnu.rengaraj.com` serves `dist/` and falls back to `index.html` for unknown paths.
- `rengaraj.com` and `www.rengaraj.com` return `301` to `https://vishnu.rengaraj.com` with the same path.

```bash
sudo mkdir -p /var/www/rengaraj
sudo cp deploy/nginx.conf /etc/nginx/sites-available/rengaraj
sudo ln -sf /etc/nginx/sites-available/rengaraj /etc/nginx/sites-enabled/rengaraj
sudo nginx -t && sudo systemctl reload nginx
```

Refreshing `/about` or `/resume/education` must return the page, not a 404.

## Caddy

`deploy/Caddyfile` does the same host split on `127.0.0.1:80`.

```bash
caddy run --config deploy/Caddyfile
```

## Cloudflare Tunnel

Send all three hostnames at the local web server. nginx does the redirect versus the site.

```yaml
ingress:
  - hostname: vishnu.rengaraj.com
    service: http://127.0.0.1:80
  - hostname: rengaraj.com
    service: http://127.0.0.1:80
  - hostname: www.rengaraj.com
    service: http://127.0.0.1:80
  - service: http_status:404
```

In the Cloudflare dashboard, attach those hostnames to the tunnel. After the tunnel answers, the GitHub Pages `CNAME` can go.

## Local preview

```bash
npm run dev      # http://localhost:5173
npm run preview  # serves dist/ on http://127.0.0.1:4173
```

## Regenerating images

Original rasters and the source videos live in `media-src/` and are not published. `node scripts/optimize-media.mjs` writes AVIF, WebP, and the lighter clips into `public/media/` (needs `sharp` and `ffmpeg`).
