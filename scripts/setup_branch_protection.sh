#!/bin/bash

# Ensure we exit on any failure
set -e

REPO="LFGBanditLabs/Quipay"
BRANCH="main"

echo "Applying branch protection rules to $REPO on branch $BRANCH..."

# Use GitHub CLI to apply branch protection rules
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/$REPO/branches/$BRANCH/protection \
  -f "enforce_admins=true" \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=Frontend" \
  -f "required_status_checks[contexts][]=Backend" \
  -f "required_status_checks[contexts][]=Contract" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"

echo "Branch protection rules applied successfully."
