---
sidebar_position: 1
---

# Pricing & Billing

Arc Cloud offers transparent, predictable pricing with no hidden fees, no egress charges, and no per-query costs.

## Free Tier

Get started with Arc Cloud at no cost:

- **1 instance** with 0.5 vCPU, 512MB RAM, and 5GB storage
- No credit card required
- No time limit

The free tier is ideal for development, testing, and small projects.

## Paid Tiers

| Tier | vCPU | Memory | Storage | DuckDB Memory | Threads | Ingest Rate | Price |
|------|------|--------|---------|---------------|---------|-------------|-------|
| Free | 0.5 | 512MB | 5GB | 256MB | 1 | 30K rec/s | $0 |
| Starter | 1 | 2GB | 50GB | 1GB | 2 | 85K rec/s | $50/mo |
| Growth | 2 | 4GB | 100GB | 2GB | 4 | 170K rec/s | $125/mo |
| Professional | 4 | 8GB | 200GB | 4GB | 8 | 250K rec/s | $225/mo |
| Business | 8 | 16GB | 500GB | 8GB | 16 | 500K rec/s | $550/mo |
| Premium | 16 | 32GB | 1TB | 16GB | 32 | 1M rec/s | $1,200/mo |
| Ultimate | 32 | 64GB | 2TB | 32GB | 64 | 2M rec/s | $2,400/mo |
| Dedicated | 36 | 256GB | 1.92TB | 128GB | 72 | Unlimited | From $4,000/mo |
| Enterprise | Custom | Custom | Custom | Custom | Custom | Custom | Contact sales |

### Annual Billing

Annual billing saves **15%** on all paid tiers. Switch between monthly and annual billing at any time from your account settings.

## How Billing Works

- **Payment processing** is handled by Stripe.
- **Charges occur at the start** of each billing period (monthly or annual).
- **Prorated upgrades** — when you upgrade mid-cycle, you pay only the difference for the remainder of your current billing period.
- **Downgrades** take effect at the start of your next billing period.

## Storage Overage

Each tier includes a fixed storage allocation. If your disk usage exceeds your plan's allocation, the excess is billed at **$0.10/GB/month**.

For example, if you are on the Starter plan (50GB included) and use 65GB, you are charged an additional $1.50/month for the 15GB overage.

## Stopped Instances

When you [stop an instance](../configuration/instances.md#starting-and-stopping-instances):

- **Compute charges are paused** — you are not billed for vCPU or memory.
- **Storage charges continue** — you are still billed for the disk space your data occupies.

This is useful for development or staging instances that you only need during working hours.

## Cancellation

- Cancel your subscription at any time from the dashboard.
- You retain access to your instance until the end of your current billing period.
- After the billing period ends, the instance is stopped and data is retained for 30 days before permanent deletion.

## No Hidden Fees

Arc Cloud pricing is straightforward:

- **No egress charges** — query and export as much data as you want.
- **No per-query pricing** — run unlimited queries.
- **No ingress charges** — send as much data as your tier's ingest rate allows.
- **No support surcharges** — all plans include standard support.
