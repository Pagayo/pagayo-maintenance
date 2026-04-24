#!/usr/bin/env bash
# check-stack-manifest.sh — Pagayo CI drift guard
#
# Doel: snel falen wanneer verboden stack-termen (GCP/AWS compute/andere
# hosting-providers/alternatieve DB's) opduiken buiten de allow-list.
#
# CI-integratie (verplicht voor elk relevant ci.yml):
#   1. checkout
#   2. ./pagayo-maintenance/scripts/check-stack-manifest.sh   <-- hier
#   3. lint
#   4. typecheck
#   5. test
# Waarom vóór lint/test: sneller en goedkoper falen.
#
# Scan-modi:
#   - Default (workspace-aware): scan twee niveaus boven dit script, d.w.z.
#     de volledige mono-workspace die alle Pagayo repos bevat.
#   - Single-repo (CI per repo): zet de env var CHECK_TARGET naar een
#     absoluut pad (bv. $GITHUB_WORKSPACE). Alleen die directory wordt
#     dan gescand. Backward-compatible: zonder CHECK_TARGET geen gedragswijziging.
#
# Referentie: pagayo-vault/STACK-MANIFEST.md
# Referentie: pagayo-vault/PAGAYO-NIVEAU.md
#
# Exit codes:
#   0  geen drift
#   1  verboden stack-term gevonden buiten allow-list
#   2  benodigde tooling ontbreekt

# -e: fail on uncaught errors (scan-commando's vangen eigen no-match via || true).
# -u: undefined vars = fout. -o pipefail: pipe-fouten niet verbergen.
# Zonder -e kan een awk-crash een lege OUTPUT geven → silent pass (Pijler 3).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
# ROOT bepaling:
#   - CHECK_TARGET env gezet → single-repo modus (alleen die dir scannen)
#   - anders → workspace-root modus (twee niveaus boven dit script)
if [[ -n "${CHECK_TARGET:-}" ]]; then
  if [[ ! -d "$CHECK_TARGET" ]]; then
    echo "check-stack-manifest: CHECK_TARGET '$CHECK_TARGET' is geen directory." >&2
    exit 2
  fi
  ROOT="$(cd "$CHECK_TARGET" && pwd)"
  echo "Stack manifest check: single-repo modus, ROOT=$ROOT"
else
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

# Verboden termen — p1-p2-grounding-restpakket sectie 4.1
# Aanpassingen t.o.v. origineel:
#   - `RDS` -> `\bRDS\b` (woord-boundary; anders matcht het in CSS class-fragmenten)
#   - `Render` vervangen door `render\.com` (generieke term veroorzaakte false positives
#     zoals renderEmail/Renderer); de hosting-provider is nog steeds verboden
#   - `Fly.io` blijft met literale punt (ERE-escaped)
PATTERN='GCP|Google Cloud Platform|Cloud Run|Cloud Functions|App Engine|\bGKE\b|Cloud SQL|Firebase|Lambda|EC2|\bECS\b|\bEKS\b|\bRDS\b|DynamoDB|Azure|Vercel|Netlify|Heroku|Fly\.io|[Rr]ender\.com|Railway|PostgreSQL|Prisma|Neon|Hyperdrive|Redis|RabbitMQ'

# Kies scanner — `rg` ondersteunt \b; GNU grep -E ook. BSD grep op macOS ondersteunt \b
# alleen via -P (PCRE) of -w. We laten de pattern onveranderd; beide scanners
# begrijpen \bRDS\b via -E op Linux/macOS moderne grep. Bij twijfel: rg verplicht.
if command -v rg >/dev/null 2>&1; then
  SCAN_KIND="rg"
elif command -v grep >/dev/null 2>&1; then
  SCAN_KIND="grep"
else
  echo "check-stack-manifest: geen rg of grep beschikbaar." >&2
  exit 2
fi

run_scan() {
  if [[ "$SCAN_KIND" == "rg" ]]; then
    rg --no-heading --line-number --color=never \
      --glob '!**/node_modules/**' \
      --glob '!**/package-lock.json' \
      --glob '!**/.wrangler/**' \
      --glob '!**/.wrangler-shared/**' \
      --glob '!**/archive/**' \
      --glob '!**/archived/**' \
      --glob '!**/prisma-archived/**' \
      --glob '!**/_legacy-pg/**' \
      --glob '!**/_legacy/**' \
      --glob '!**/legacy/**' \
      --glob '!**/.vscode/settings.json' \
      --glob '!**/*.code-workspace' \
      --glob '!**/prompts/*.prompt.md' \
      --glob '!**/.git/**' \
      --glob '!**/coverage/**' \
      --glob '!**/dist/**' \
      --glob '!**/.astro/**' \
      --glob '!**/.playwright-cli/**' \
      --glob '!**/build/**' \
      --glob '!**/out/**' \
      --glob '!**/*.min.js' \
      --glob '!**/*.min.css' \
      --glob '!**/*.map' \
      --glob '!**/memories/**' \
      --glob '!**/worker-configuration.d.ts' \
      --glob '!**/playwright-report/**' \
      --glob '!**/.env' \
      --glob '!**/.env.*' \
      --glob '!**/.tmp-*/**' \
      --glob '!**/migrations/_archive/**' \
      --glob '!**/.gitkeep' \
      --glob '!**/.gitignore' \
      --glob '!**/dependabot.yml' \
      --glob '!**/public/assets/**' \
      --glob '!**/STACK-MANIFEST.md' \
      --glob '!**/PAGAYO-NIVEAU.md' \
      --glob '!**/copilot-instructions.md' \
      --glob '!**/AGENTS.md' \
      --glob '!**/*.agent.md' \
      --glob '!**/check-stack-manifest.sh' \
      --glob '!**/werkplannen/**' \
      --glob '!**/werkvoorbereiding-*.md' \
      -e "$PATTERN" "$ROOT" 2>/dev/null || true
  else
    grep -rn -E \
      --exclude-dir=node_modules \
      --exclude-dir=.wrangler \
      --exclude-dir=.wrangler-shared \
      --exclude-dir=archive \
      --exclude-dir=archived \
      --exclude-dir=_archive \
      --exclude-dir=.tmp-staging-inspect \
      --exclude-dir=prisma-archived \
      --exclude-dir=_legacy-pg \
      --exclude-dir=_legacy \
      --exclude-dir=legacy \
      --exclude-dir=.git \
      --exclude-dir=coverage \
      --exclude-dir=dist \
      --exclude-dir=.astro \
      --exclude-dir=.playwright-cli \
      --exclude-dir=build \
      --exclude-dir=out \
      --exclude-dir=memories \
      --exclude=package-lock.json \
      --exclude='*.min.js' \
      --exclude='*.min.css' \
      --exclude='*.map' \
      --exclude='worker-configuration.d.ts' \
      --exclude-dir=playwright-report \
      --exclude='.env' \
      --exclude='.env.*' \
      --exclude='.gitkeep' \
      --exclude='.gitignore' \
      --exclude='dependabot.yml' \
      --exclude='settings.json' \
      --exclude='*.code-workspace' \
      --exclude='*.prompt.md' \
      --exclude=STACK-MANIFEST.md \
      --exclude=PAGAYO-NIVEAU.md \
      --exclude=copilot-instructions.md \
      --exclude=AGENTS.md \
      --exclude='*.agent.md' \
      --exclude=check-stack-manifest.sh \
      --exclude-dir=werkplannen \
      --exclude='werkvoorbereiding-*.md' \
      -- "$PATTERN" "$ROOT" 2>/dev/null || true
  fi
}

# awk filter:
#   - splitst path:lineno:content
#   - strip allow-listed Google-phrases
#   - matched = eerste verboden term in gestripte content
#   - cloudflare-ops-agent/ regels met 'legacy'/'drift' (case-insensitive) toegestaan
#   - skip self-reference naar dit script
#   - output: "<path>:<lineno>: <term>"
#
# Let op: BSD awk (macOS) ondersteunt geen \b, dus we geven awk een pattern
# zonder word-boundaries en simuleren de RDS word-boundary handmatig.
# Word-boundary is op awk-niveau niet beschikbaar in BSD awk; voor
# afko's die ook in gewone woorden voorkomen (EKS in TEKST, ECS in specs,
# GKE in tokens, RDS in rand-id's) doen we hieronder een handmatige
# boundary-check, analoog aan de RDS-behandeling.
AWK_PAT='GCP|Google Cloud Platform|Cloud Run|Cloud Functions|App Engine|GKE|Cloud SQL|Firebase|Lambda|EC2|ECS|EKS|RDS|DynamoDB|Azure|Vercel|Netlify|Heroku|Fly\.io|[Rr]ender\.com|Railway|PostgreSQL|Prisma|Neon|Hyperdrive|Redis|RabbitMQ'

OUTPUT="$(
  run_scan | awk -v self="$SCRIPT_PATH" -v pat="$AWK_PAT" '
    {
      # split op eerste twee colons
      p1 = index($0, ":")
      if (p1 == 0) next
      path = substr($0, 1, p1 - 1)
      rest1 = substr($0, p1 + 1)
      p2 = index(rest1, ":")
      if (p2 == 0) next
      lineno = substr(rest1, 1, p2 - 1)
      content = substr(rest1, p2 + 1)

      if (path == self) next
      if (lineno !~ /^[0-9]+$/) next

      stripped = content
      gsub(/Google Cloud Console/, "", stripped)
      gsub(/Google Drive API/,    "", stripped)
      gsub(/Google Sign-In/,      "", stripped)

      # Zoek eerste verboden term; voor RDS valideer word-boundary handmatig,
      # anders skippen en verder zoeken in de rest van de regel.
      search = stripped
      offset = 0
      term = ""
      while (match(search, pat) > 0) {
        cand = substr(search, RSTART, RLENGTH)
        abs_start = offset + RSTART
        if (cand == "RDS" || cand == "EKS" || cand == "ECS" || cand == "GKE") {
          before = (abs_start > 1) ? substr(stripped, abs_start - 1, 1) : ""
          after  = substr(stripped, abs_start + RLENGTH, 1)
          if (before ~ /[A-Za-z0-9_]/ || after ~ /[A-Za-z0-9_]/) {
            # geen echte word match; ga door voorbij deze match
            offset = abs_start + RLENGTH - 1
            search = substr(stripped, offset + 1)
            continue
          }
        }
        term = cand
        break
      }
      if (term == "") next

      # cloudflare-ops-agent/ allow-list op regelniveau (legacy/drift)
      if (index(path, "cloudflare-ops-agent/") > 0) {
        lc = tolower(content)
        if (index(lc, "legacy") > 0 || index(lc, "drift") > 0) next
      }

      # Regel-niveau suppressor: elke regel met de marker
      # `stack-manifest-ignore` wordt overgeslagen. Gebruik spaarzaam
      # en alleen voor legitieme legacy-context in actieve code.
      if (index(content, "stack-manifest-ignore") > 0) next

      # Banner-based exclusion: bestanden met "HISTORISCH DOCUMENT" of
      # "stack-manifest-ignore-file" in de eerste 20 regels zijn bewust
      # bewaarde legacy-context en vallen buiten de drift-scope. Resultaat
      # per pad cachen om I/O te beperken.
      if (!(path in banner_cache)) {
        banner_cache[path] = 0
        n = 0
        while ((getline ln < path) > 0) {
          n++
          if (index(ln, "HISTORISCH DOCUMENT") > 0 || index(ln, "stack-manifest-ignore-file") > 0) {
            banner_cache[path] = 1
            break
          }
          if (n >= 20) break
        }
        close(path)
      }
      if (banner_cache[path] == 1) next

      printf "%s:%s: %s\n", path, lineno, term
    }
  '
)"

if [[ -n "$OUTPUT" ]]; then
  printf '%s\n' "$OUTPUT"
  echo "Verboden stack-term gevonden buiten allow-list. Zie pagayo-vault/STACK-MANIFEST.md."
  exit 1
fi

echo "Stack manifest check: OK"
exit 0
