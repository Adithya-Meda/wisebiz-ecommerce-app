# WiseBiz Ecommerce App

Production-ready Node.js microservices e-commerce platform. Designed to demonstrate real-world DevOps practices: containerised services, GitOps deployments, cloud-native infrastructure, and zero-trust security.

## Related Repositories

| Repository | Purpose |
|---|---|
| **wisebiz-ecommerce-app** (this repo) | 9 Node.js microservices, Dockerfiles, CI/CD pipelines |
| [wisebiz-terraform](https://github.com/Adithya-Meda/wisebiz-terraform) | AWS infrastructure: VPC, EKS, RDS, ElastiCache, AmazonMQ, ECR, IAM |
| [wisebiz-gitops](https://github.com/Adithya-Meda/wisebiz-gitops) | Helm chart, ArgoCD applications, environment values |

## Services

| Service | Port | Responsibility | Data Store |
|---|---|---|---|
| `api-gateway` | 3000 | Reverse proxy, JWT auth middleware, rate limiting | — |
| `auth-svc` | 3001 | JWT issue/refresh/revoke | PostgreSQL |
| `user-svc` | 3002 | User profiles, avatar upload (S3) | PostgreSQL |
| `product-svc` | 3003 | Product catalogue, image upload (S3) | MongoDB |
| `cart-svc` | 3004 | Shopping cart with TTL | Redis |
| `order-svc` | 3005 | Order lifecycle, publishes to RabbitMQ | PostgreSQL |
| `payment-svc` | 3006 | Payment processing, updates order status | PostgreSQL |
| `notification-svc` | 3007 | Consumes RabbitMQ, sends email via SMTP/SES | — |
| `frontend-svc` | 8080 | Server-side rendered frontend | — |

## Architecture

```
Internet → ALB → api-gateway → auth-svc
                             → user-svc
                             → product-svc
                             → cart-svc → order-svc → payment-svc
                                                     ↓ RabbitMQ
                             → frontend-svc  notification-svc → Email
```

**On EKS (production):**
- Istio service mesh with mTLS STRICT between all services
- Istio AuthorizationPolicies (default deny-all + per-service ALLOW)
- Kubernetes NetworkPolicies as a defence-in-depth layer
- External Secrets Operator pulls credentials from AWS Secrets Manager at runtime

## Local Development

### Prerequisites

- Docker Desktop (or Docker Engine + `docker compose` plugin)
- A `NPM_TOKEN_FILE` pointing to a file containing your GitHub Packages PAT (needed for `@Adithya-Meda/wisebiz-shared`)

### Quick start

```bash
# 1. Copy and fill in environment config
cp .env.example .env
# Edit .env — fill in any values you want to override (JWT secrets, etc.)

# 2. Set the token file path (required for private package install)
export NPM_TOKEN_FILE=/path/to/your/token-file

# 3. Start all services
docker compose up --build

# 4. Access the app
# Frontend:    http://localhost:8080
# API Gateway: http://localhost:3000
# RabbitMQ UI: http://localhost:15672 (guest/guest)
```

### Stopping

```bash
docker compose down
# To also remove volumes (wipes local DB data):
docker compose down -v
```

## CI/CD Pipeline

```
PR opened         → ci.yml: lint (ESLint) + Trivy scan (CRITICAL/HIGH CVEs)
Merge to main     → ci.yml: build images, push to ECR with git-sha tag
                    ↓ on success
                    cd-staging.yml: verify ECR images → update values-staging.yaml → ArgoCD sync
                    ↓ manual trigger
                    cd-prod.yml: approval gate → staging health check → create GitHub Release
                                 → update values-prod.yaml → ArgoCD sync → production health probe
```

All CI/CD uses **OIDC-based AWS authentication** — no static AWS credentials stored anywhere.

## Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Required GitHub Secrets

| Secret | Description |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | OIDC role for ECR push and AWS operations |
| `NODE_AUTH_TOKEN` | GitHub Packages PAT for `@Adithya-Meda/wisebiz-shared` |
| `GITOPS_TOKEN` | PAT with write access to `wisebiz-gitops` repo |
| `ARGOCD_STAGING_TOKEN` | ArgoCD `staging-deployer` project JWT |
| `ARGOCD_PROD_TOKEN` | ArgoCD `prod-deployer` project JWT |

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. Key variables:

| Variable | Description |
|---|---|
| `JWT_ACCESS_SECRET` | Min 64 chars — used to sign access tokens |
| `POSTGRES_HOST` | PostgreSQL hostname (overridden by compose to container name) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_HOST` | Redis hostname |
| `RABBITMQ_URL` | RabbitMQ AMQP URL |

**Never commit `.env` to version control.** It is gitignored. Use `.env.example` as the template.
