#!/usr/bin/env bash
# Uploads a built site to a Cloudflare R2 bucket with Wrangler.
#
#   scripts/deploy-r2.sh <dist-dir> <bucket>
#
# Needs CLOUDFLARE_API_TOKEN (R2 edit permission) and CLOUDFLARE_ACCOUNT_ID.
# Hashed files in assets/ are cached for a year; everything else for 5 minutes.
# HTML goes last, so a visitor never gets a page that points at assets not uploaded yet.
set -euo pipefail

dist="${1:?dist directory}"
bucket="${2:?bucket name}"
wrangler="npx --no-install wrangler"

content_type() {
    case "$1" in
        *.html) echo "text/html; charset=utf-8" ;;
        *.css) echo "text/css; charset=utf-8" ;;
        *.js) echo "text/javascript; charset=utf-8" ;;
        *.svg) echo "image/svg+xml" ;;
        *.png) echo "image/png" ;;
        *.jpg | *.jpeg) echo "image/jpeg" ;;
        *.webp) echo "image/webp" ;;
        *.ico) echo "image/x-icon" ;;
        *.json | *.webmanifest) echo "application/json" ;;
        *.txt) echo "text/plain; charset=utf-8" ;;
        *.xml) echo "application/xml" ;;
        *.woff2) echo "font/woff2" ;;
        *) echo "application/octet-stream" ;;
    esac
}

upload() {
    local file="$1" key="${1#"$dist"/}" cache
    case "$key" in
        assets/*) cache="public, max-age=31536000, immutable" ;;
        *) cache="public, max-age=300, must-revalidate" ;;
    esac
    echo "→ $key"
    $wrangler r2 object put "$bucket/$key" --remote \
        --file "$file" \
        --content-type "$(content_type "$file")" \
        --cache-control "$cache" >/dev/null
}

find "$dist" -type f ! -name '*.html' | sort | while read -r f; do upload "$f"; done
find "$dist" -type f -name '*.html' | sort | while read -r f; do upload "$f"; done

echo "Deployed $dist to r2://$bucket"
