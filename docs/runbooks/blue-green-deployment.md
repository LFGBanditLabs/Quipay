# Blue-Green Deployment Runbook

## Overview

Quipay uses a blue-green deployment strategy to achieve zero-downtime releases. Two identical environments (blue and green) exist in parallel. At any time, one serves live traffic while the other is idle or receiving the new release.

## How It Works

```
1. Blue is live, serving production traffic
2. New version is deployed to Green
3. Smoke tests run against Green
4. Load balancer switches traffic from Blue to Green
5. Green is now live
6. Blue remains available for 10 minutes as a rollback target
7. If error rate > 5%, automatic rollback to Blue
```

## Automated Pipeline

The `blue-green-deploy.yml` workflow automates the full process:

| Stage        | Description                                   | Auto-rollback |
| ------------ | --------------------------------------------- | ------------- |
| Build        | Build and push container image to GHCR        | No            |
| Deploy Green | Deploy new image to green environment         | No            |
| Smoke Test   | Health and API checks against green           | Yes           |
| Cutover      | Switch load balancer traffic to green         | Yes           |
| Monitor      | 5-minute error rate monitoring (threshold 5%) | Yes           |
| Rollback     | Switch back to blue if monitoring fails       | Automatic     |

## Manual Deployment

Trigger a deployment via GitHub Actions:

1. Go to Actions > Blue-Green Deployment
2. Click "Run workflow"
3. Select the target environment (staging or production)
4. Monitor the pipeline progress

## Manual Rollback

If automatic rollback fails or you need to roll back after the monitoring window:

```bash
# Cloud Run example
gcloud run services update-traffic quipay \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1

# Kubernetes example
kubectl patch service quipay \
  -p '{"spec":{"selector":{"slot":"blue"}}}'
```

## Required Secrets

| Secret                  | Description                       |
| ----------------------- | --------------------------------- |
| `GREEN_ENVIRONMENT_URL` | URL of the green environment      |
| `PRODUCTION_URL`        | URL of the production environment |
| `GITHUB_TOKEN`          | Auto-provided for GHCR push       |

## Verifying Zero Downtime

During deployment, monitor the production health endpoint:

```bash
while true; do
  curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://quipay.app/health
  sleep 1
done
```

All requests should return 200 throughout the cutover.
