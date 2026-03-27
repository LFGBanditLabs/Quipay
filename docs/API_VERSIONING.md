# Quipay API Versioning Strategy

This document outlines the API versioning strategy for the Quipay platform. It provides guidelines on how we handle version bumps, deprecation, and breaking changes for both our frontend applications and third-party integrators.

## Current API Version

- **Current Version:** `v1`

## Versioning Approach

Quipay uses **URL Prefix Versioning** (e.g., `/v1/`, `/v2/`) as the primary mechanism for routing API requests.
This approach provides an explicit and straightforward integration experience, as developers can visually track the version they are consuming directly from the endpoint URLs.

We do _not_ rely on header-based versioning (e.g., `Accept: application/vnd.quipay.v1+json`) as the primary routing mechanism to ensure maximum simplicity and CDN cacheability.

## What Constitutes a Breaking Change?

A new major API version (e.g., bumping from `v1` to `v2`) is strictly required when introducing **breaking changes**. A breaking change is any modification that could cause an existing integration to fail. Examples include:

- Removing an existing endpoint or supported HTTP method.
- Removing or renaming an existing field in a request payload or response body.
- Changing the data type of an existing field (e.g., from `string` to `integer`).
- Changing the validation rules for a field in a way that makes previously valid payloads invalid (e.g., adding a new required field, or making an optional field required).
- Significantly altering the business logic or expected behavior of an endpoint in a way that breaks existing assumptions.

**Non-breaking changes** (which do _not_ require a version bump) include:

- Adding new endpoints.
- Adding new, optional fields to existing request payloads.
- Adding new fields to existing response bodies.
- Fixing bugs without altering the documented behavior of the API.

## Deprecation Policy

When a new API version is released, the older version(s) will be formally deprecated but maintained and supported for a transition period.

- **Minimum Notice:** Integrators will receive a minimum of **90 days** notice before any API version or endpoint is fully sunset (removed).
- **Communication:** Deprecation notices will be communicated via the developer hub, targeted email campaigns to registered integrations, and prominently displayed in the API documentation.
- **Headers:** Deprecated endpoints will additionally return a `Deprecation: true` HTTP response header to programmatically alert integrators during the sunset period.

## Migration Guide Template

Whenever a new API version is introduced, a comprehensive migration guide must be published. Please use the following template for all future migration guides:

---

### Migration Guide: v[OLD] to v[NEW]

**Release Date:** [YYYY-MM-DD]  
**Sunset Date for v[OLD]:** [YYYY-MM-DD] _(Minimum 90 days from release)_

#### Overview

[Brief summary of why the new version was created and the primary benefits for migrating.]

#### Summary of Breaking Changes

- **Endpoints Removed:** [List of endpoints]
- **Endpoints Renamed/Moved:** [e.g., `/v1/users` -> `/v2/accounts`]
- **Payload Changes:** [e.g., `userId` is now `account_id`]

#### Step-by-Step Migration

1. **[Area 1]**: [Explanation of how to update integrations to accommodate the change, including before/after JSON payload or URL examples.]
2. **[Area 2]**: [Explanation for the next area...]

#### Need Help?

## Contact our integration support team or reach out on the Developer Community portal.
