# Quipay Backend — Kubernetes Deployment

This directory contains the Helm chart and deployment documentation for the Quipay backend service.

## Prerequisites

| Tool      | Version              | Install                                                 |
| --------- | -------------------- | ------------------------------------------------------- |
| `kubectl` | >= 1.27              | [docs](https://kubernetes.io/docs/tasks/tools/)         |
| `helm`    | >= 3.12              | [docs](https://helm.sh/docs/intro/install/)             |
| `kind`    | >= 0.20 (local only) | [docs](https://kind.sigs.k8s.io/docs/user/quick-start/) |

## Chart Structure

```
deploy/helm/quipay-backend/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default values
└── templates/
    ├── _helpers.tpl    # Named template helpers
    ├── configmap.yaml  # Non-sensitive env vars
    ├── secret.yaml     # Sensitive env vars (base64-encoded)
    ├── deployment.yaml # App deployment
    ├── service.yaml    # ClusterIP service
    └── hpa.yaml        # Horizontal Pod Autoscaler (2–10 replicas)
```

## Local Deployment (kind)

```bash
# Create a local cluster
kind create cluster --name quipay-local

# Install the chart with test secrets
helm install quipay-backend deploy/helm/quipay-backend \
  --set image.tag=local \
  --set secrets.DATABASE_URL="postgresql://postgres:password@localhost:5432/quipay" \
  --set secrets.JWT_SECRET="local-dev-secret" \
  --set secrets.STELLAR_SECRET_KEY="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Verify
kubectl get pods
kubectl get svc
```

## Production Deployment (GKE / EKS)

```bash
# Authenticate to your cluster
gcloud container clusters get-credentials <cluster-name> --region <region>
# or
aws eks update-kubeconfig --name <cluster-name> --region <region>

# Deploy with production values
helm upgrade --install quipay-backend deploy/helm/quipay-backend \
  --namespace quipay \
  --create-namespace \
  --set image.tag=$IMAGE_TAG \
  --set secrets.DATABASE_URL="$DATABASE_URL" \
  --set secrets.JWT_SECRET="$JWT_SECRET" \
  --set secrets.STELLAR_SECRET_KEY="$STELLAR_SECRET_KEY"
```

> **Security note:** Never commit secret values. Use `--set` flags, a secrets manager (e.g. [External Secrets Operator](https://external-secrets.io/)), or sealed secrets in CI.

## Autoscaling

The HPA scales between **2 and 10 replicas** based on CPU utilisation (default threshold: 70%). Adjust in `values.yaml`:

```yaml
autoscaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

## Configuration Reference

| Value                 | Default                                | Description                                     |
| --------------------- | -------------------------------------- | ----------------------------------------------- |
| `image.repository`    | `ghcr.io/lfgbanditlabs/quipay-backend` | Container image                                 |
| `image.tag`           | `latest`                               | Image tag (set by CI)                           |
| `replicaCount`        | `2`                                    | Static replica count (ignored when HPA enabled) |
| `service.port`        | `80`                                   | Service port                                    |
| `service.targetPort`  | `3000`                                 | Container port                                  |
| `env.NODE_ENV`        | `production`                           | Node environment                                |
| `env.PORT`            | `3000`                                 | App listen port                                 |
| `autoscaling.enabled` | `true`                                 | Enable HPA                                      |

## Uninstall

```bash
helm uninstall quipay-backend --namespace quipay
```
