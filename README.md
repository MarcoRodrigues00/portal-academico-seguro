# 🔐 Portal Acadêmico Seguro (PAS)

> A secure academic portal built defense-first and validated under real, cross-team attacks.
> Portal acadêmico seguro, construído com foco em defesa e validado sob ataques reais entre equipes.

![Backend](https://img.shields.io/badge/backend-Node.js%20%C2%B7%20Express%20%C2%B7%20TypeScript-3178c6?logo=typescript&logoColor=white)
![Frontend](https://img.shields.io/badge/frontend-React%20%C2%B7%20Vite-61dafb?logo=react&logoColor=black)
![Auth](https://img.shields.io/badge/auth-Keycloak%20%C2%B7%20MFA%2FTOTP-blue)
![WAF](https://img.shields.io/badge/edge-Nginx%20%C2%B7%20ModSecurity%20(OWASP%20CRS)-009639?logo=nginx&logoColor=white)
![Infra](https://img.shields.io/badge/infra-Docker%20segmented%20network-2496ed?logo=docker&logoColor=white)
![Monitoring](https://img.shields.io/badge/monitoring-Wazuh%20%C2%B7%20Prometheus%20%C2%B7%20Grafana-orange)

---

## Overview

A web portal for students, professors and admins (grades, enrollment proofs, requests,
public courses) designed around layered security and continuous monitoring — then put
under real adversarial pressure in a 10-team lab exercise.

## Security architecture (defense in depth)

| Layer | What's there |
|------|--------------|
| **Edge** | pfSense firewall (deny-all by default, only 80/443 exposed, WAN/server segmentation) |
| **DMZ** | Nginx reverse proxy with TLS 1.2/1.3, **ModSecurity WAF (OWASP CRS)** vs SQLi/XSS/CSRF, per-IP rate limiting, security headers (HSTS, X-Frame-Options, CSP) |
| **App** | Keycloak with **MFA/TOTP**, RBAC per role (admin/professor/aluno/externo), `express-rate-limit`, Helmet.js, Zod validation, audit logging |
| **Data** | PostgreSQL isolated in its own network zone, never exposed externally |
| **Monitoring** | Wazuh SIEM, Prometheus metrics, Grafana dashboards, Restic encrypted backups |
| **Hardening** | AppArmor, SSH key-only, fail2ban, non-root containers, read-only volumes where possible |

## Network topology

```
Internet ──> pfSense (NAT/FW, only 80/443) ──> nginx-proxy (DMZ)
                                                   │
                                   frontend · backend-api · keycloak (APP)
                                                   │
                                            postgres (DATA, internal only)

App hosts ──logs/metrics──> Monitoring host: Wazuh · Prometheus · Grafana · Restic
```

## Tech stack

- **Backend:** Node.js, Express, TypeScript, Prisma
- **Frontend:** React, Vite, TypeScript
- **Infra:** Docker / docker-compose, Nginx, Keycloak, PostgreSQL

## Repository layout

```
portal-academico-seguro/
├─ backend/    # API: Express + TypeScript + Prisma
├─ frontend/   # React + Vite + TypeScript
├─ infra/      # docker-compose, keycloak themes, env examples
└─ docker-compose.app.yml
```

## Getting started

```bash
# 1) Copy the env templates and fill in your own values
cp .env.example .env
cp infra/.env.example infra/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2) Bring the stack up
docker compose -f docker-compose.app.yml up -d
docker compose -f docker-compose.app.yml ps
```

> 🔒 No real secrets are committed — only `.env.example` files. Never commit a real `.env`.

## Validated under attack

In a 10-team exercise the portal faced live attacks from other teams while I tested theirs.
Observed defenses holding: WAF returning **403** on SQLi/XSS, rate limiting hitting **429**,
and corresponding alerts in Wazuh.

## 📸 Screenshots

> Add captures here: WAF blocking an attack (403), rate limit (429),
> a Wazuh alert, and a Grafana dashboard.
