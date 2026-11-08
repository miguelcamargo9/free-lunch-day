#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env.local ] && source .env.local

: "${DEPLOY_AWS_ACCOUNT_ID:?Set DEPLOY_AWS_ACCOUNT_ID in .env.local (see .env.example)}"
profile="${DEPLOY_AWS_PROFILE:-personal}"
stage="${STAGE:-dev}"

account="$(aws sts get-caller-identity --profile "$profile" --query Account --output text)"
if [ "$account" != "$DEPLOY_AWS_ACCOUNT_ID" ]; then
  echo "Refusing to deploy: profile '$profile' is account $account, expected $DEPLOY_AWS_ACCOUNT_ID" >&2
  exit 1
fi

echo "Deploying stage '$stage' to account $account with profile '$profile'"
AWS_PROFILE="$profile" npx serverless deploy --stage "$stage" "$@"
