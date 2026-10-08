#!/usr/bin/env bash
# Uploads a built site to a Cloudflare R2 bucket with Wrangler.
#
#   scripts/deploy-r2.sh [<dist-dir> [<bucket>]]
#
# Needs CLOUDFLARE_API_TOKEN (R2 edit permission) and CLOUDFLARE_ACCOUNT_ID.
# Bucket defaults to CLOUDFLARE_R2_BUCKET; dist-dir defaults to dist.
# A .env file in the repo root is loaded if present; variables already set in the
# environment (for example CI secrets) take precedence over it.
# Hashed files in assets/ are cached for a year; everything else for 5 minutes.
# HTML goes last, so a visitor never gets a page that points at assets not uploaded yet.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$root/.env" ]]; then
    while IFS='=' read -r name value || [[ -n "$name" ]]; do
        [[ "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
        value="${value%$'\r'}"
        value="${value#[\"\']}"
        value="${value%[\"\']}"
        [[ -n "${!name:-}" ]] || export "$name=$value"
    done <"$root/.env"
fi

dist="${1:-dist}"
bucket="${2:-${CLOUDFLARE_R2_BUCKET:-}}"

missing=()
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || missing+=(CLOUDFLARE_API_TOKEN)
[[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || missing+=(CLOUDFLARE_ACCOUNT_ID)
[[ -n "$bucket" ]] || missing+=(CLOUDFLARE_R2_BUCKET)
if ((${#missing[@]})); then
    echo "Missing configuration: ${missing[*]}" >&2
    exit 1
fi
[[ -d "$dist" ]] || { echo "Dist directory not found: $dist" >&2; exit 1; }

wrangler=(npx --no-install wrangler)

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
    "${wrangler[@]}" r2 object put "$bucket/$key" --remote \
        --file "$file" \
        --content-type "$(content_type "$file")" \
        --cache-control "$cache" >/dev/null
}

while IFS= read -r -d '' f; do upload "$f"; done < <(find "$dist" -type f ! -name '*.html' -print0 | sort -z)
while IFS= read -r -d '' f; do upload "$f"; done < <(find "$dist" -type f -name '*.html' -print0 | sort -z)

echo "Deployed $dist to r2://$bucket"
