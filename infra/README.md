# Quipay Infrastructure as Code

This directory contains Terraform configurations for provisioning and managing Quipay's cloud infrastructure.

## Overview

All cloud resources are defined declaratively, enabling reproducible environments, version-controlled infrastructure changes, and rapid disaster recovery.

## Directory Structure

```
infra/
  README.md              # This file
  main.tf                # Root module, provider config, remote state
  variables.tf           # Input variables (shared across environments)
  outputs.tf             # Exported values (endpoints, IDs)
  versions.tf            # Required provider versions and constraints
  modules/
    database/            # PostgreSQL (Cloud SQL / RDS / Neon)
      main.tf
      variables.tf
      outputs.tf
    cache/               # Redis (Memorystore / ElastiCache / Upstash)
      main.tf
      variables.tf
      outputs.tf
    load_balancer/       # HTTPS load balancer + TLS certificate
      main.tf
      variables.tf
      outputs.tf
    dns/                 # DNS zone and records
      main.tf
      variables.tf
      outputs.tf
  environments/
    staging.tfvars       # Staging overrides
    production.tfvars    # Production overrides
```

## Prerequisites

| Tool      | Version | Install                                           |
| --------- | ------- | ------------------------------------------------- |
| Terraform | >= 1.7  | https://developer.hashicorp.com/terraform/install |
| Cloud CLI | latest  | `gcloud` / `aws` / `az` depending on provider     |

## Remote State

State is stored in a remote backend with locking to prevent concurrent modifications:

- **GCP**: GCS bucket + no native lock (use `terraform force-unlock` if needed)
- **AWS**: S3 bucket + DynamoDB table for locking
- **Azure**: Azure Storage Account with blob lease locking

Configure the backend in `main.tf` before running any commands.

## Quick Start

```bash
# 1. Authenticate with your cloud provider
gcloud auth application-default login   # GCP
# aws configure                          # AWS

# 2. Initialize Terraform
cd infra
terraform init

# 3. Select workspace
terraform workspace select staging
# or: terraform workspace new staging

# 4. Plan changes
terraform plan -var-file=environments/staging.tfvars

# 5. Apply changes
terraform apply -var-file=environments/staging.tfvars
```

## Workspaces

Staging and production use separate Terraform workspaces to isolate state:

```bash
terraform workspace list
terraform workspace select production
terraform plan -var-file=environments/production.tfvars
```

## Destroy and Recreate

To tear down an environment completely:

```bash
terraform workspace select staging
terraform destroy -var-file=environments/staging.tfvars
```

To recreate from scratch:

```bash
terraform apply -var-file=environments/staging.tfvars
```

This should produce a fully functional environment matching the declared configuration.

## Adding New Resources

1. Create a new module under `modules/` if the resource is reusable
2. Wire it into `main.tf`
3. Add variables to `variables.tf` and environment-specific values to `*.tfvars`
4. Run `terraform plan` to verify, then `terraform apply`

## Drift Detection

To check if the live infrastructure matches the Terraform state:

```bash
terraform plan -var-file=environments/production.tfvars -detailed-exitcode
```

Exit code 2 means drift was detected. Review the diff and apply or import as needed.
