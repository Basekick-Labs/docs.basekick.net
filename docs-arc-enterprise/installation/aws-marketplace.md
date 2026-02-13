---
sidebar_position: 4
---

# AWS Marketplace

Deploy Arc on AWS with a single click using our pre-configured AMI from AWS Marketplace.

## Overview

Arc is available on AWS Marketplace as a ready-to-run AMI. No license keys, no sales calls—just subscribe and launch.

**What you get:**
- Pre-installed Arc with systemd service
- Ubuntu-based AMI
- All features enabled
- Free to use (AGPL-3.0)
- Optional enterprise support ($500/month)

## Prerequisites

- AWS Account
- EC2 key pair for SSH access
- VPC with appropriate subnets
- (Production) ACM certificate for HTTPS

## Quick Start (Dev/Testing Only)

:::warning Not for Production
This pattern exposes your database directly to the internet. Use only for testing and evaluation.
:::

1. **Subscribe to Arc on AWS Marketplace**

   [Open Arc on AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-mkhhh2vk4fyss)

2. **Launch an EC2 instance** with a public IP

3. **Configure security group** to allow port 8000 (restrict to your IP)

4. **Get your admin token:**

```bash
# SSH into your instance (Ubuntu-based AMI)
ssh -i your-key.pem ubuntu@your-instance-ip

# View Arc logs to find the admin token
sudo journalctl -u arc | grep "Admin token"

# You'll see something like:
# Admin token: ark_abc123...xyz
```

5. **Test the connection:**

```bash
export ARC_URL="http://your-instance-ip:8000"
export ARC_TOKEN="your-token-here"

curl $ARC_URL/health
```

## Production Deployment (Recommended)

For production workloads, deploy Arc behind an Application Load Balancer in a private subnet.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ VPC (10.0.0.0/16)                                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Public Subnet (10.0.0.0/24)                        │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────┐              │  │
│  │  │ Application Load Balancer (ALB)  │              │  │
│  │  │ - HTTPS (443) with SSL cert      │              │  │
│  │  │ - Terminates TLS                 │              │  │
│  │  │ - Health checks                  │              │  │
│  │  └────────────┬─────────────────────┘              │  │
│  │               │                                    │  │
│  └───────────────┼────────────────────────────────────┘  │
│                  │ HTTP (8000)                           │
│  ┌───────────────┼────────────────────────────────────┐  │
│  │ Private Subnet (10.0.1.0/24)       │               │  │
│  │                                    ▼               │  │
│  │  ┌──────────────────────────────────────┐          │  │
│  │  │ Arc Instance                         │          │  │
│  │  │ - No public IP                       │          │  │
│  │  │ - Port 8000 from ALB only            │          │  │
│  │  │ - EBS storage for Parquet files      │          │  │
│  │  └──────────────────────────────────────┘          │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Optional:                                               │
│  • Telegraf in same VPC                                  │
│  • Grafana in same VPC                                   │
│  • NAT Gateway for outbound                              │
└──────────────────────────────────────────────────────────┘
```

**Benefits:**
- SSL termination at ALB (free certificate from ACM)
- Arc in private subnet (no internet exposure)
- Security groups restrict traffic
- Health checks and monitoring

### Step 1: Subscribe to Arc

1. Go to [Arc on AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-mkhhh2vk4fyss)
2. Click **View purchase options**
3. Click **Subscribe**
4. Wait for subscription to activate, then click **Continue to Configuration**

### Step 2: Launch Configuration

1. Select your **Region**
2. Choose an **Instance type**:
   - Testing: `t3.large` (2 vCPU, 8 GB RAM)
   - Production: `m8a.xlarge` or larger
3. Click **Continue to Launch**

### Step 3: Configure Network Settings

1. **VPC:** Select your existing VPC or create a new one
2. **Subnet:** Choose a private subnet (no internet gateway route)
3. **Security Group:** Create a new one that allows:
   - Inbound: Port 8000 from your ALB security group only
   - Outbound: As needed for your environment
4. Click **Launch**

### Step 4: Create a Target Group

Before creating the load balancer, create a target group.

1. Go to **EC2 Console** → **Target Groups** → **Create target group**
2. Configure:
   - **Target type:** Instances
   - **Target group name:** `arc-target-group`
   - **Protocol:** HTTP
   - **Port:** 8000
   - **VPC:** Same VPC as Arc instance
3. **Health checks:**
   - **Path:** `/health`
   - **Healthy threshold:** 2
   - **Unhealthy threshold:** 2
   - **Timeout:** 5 seconds
   - **Interval:** 30 seconds
4. Click **Next**, select your Arc instance, click **Include as pending below**
5. Click **Create target group**

### Step 5: Create the Application Load Balancer

1. Go to **EC2 Console** → **Load Balancers** → **Create load balancer**
2. Select **Application Load Balancer**
3. Configure:
   - **Name:** `arc-alb`
   - **Scheme:** Internet-facing
   - **IP address type:** IPv4
4. **Network mapping:**
   - Select your VPC
   - Select at least two public subnets (one per AZ)
5. **Security groups:**
   - Allow inbound HTTPS (443) from your allowed IP ranges
6. **Listeners:**
   - Protocol: HTTPS, Port: 443
   - Default action: Forward to `arc-target-group`
7. **Secure listener settings:**
   - Security policy: `ELBSecurityPolicy-TLS13-1-2-2021-06`
   - Certificate: Select from ACM (free) or import your own
8. Click **Create load balancer**

### Step 6: Point Your Domain to the Load Balancer

1. Go to **Load Balancers** and copy the **DNS name**

**Using Route 53:**

1. Go to **Route 53** → **Hosted zones** → your domain
2. Click **Create record**
3. Configure:
   - **Record name:** `arc` (for `arc.yourdomain.com`)
   - **Record type:** A
   - **Alias:** Yes
   - **Route traffic to:** Application Load Balancer
   - **Region:** Your ALB's region
   - **Load balancer:** Select your ALB
4. Click **Create records**

**Using External DNS:**

Create a CNAME record pointing to the ALB DNS name:
- **Name:** `arc`
- **Type:** CNAME
- **Value:** `arc-alb-xxxxx.us-east-1.elb.amazonaws.com`

:::note
CNAME records don't work for apex domains. Use a subdomain like `arc.yourdomain.com`.
:::

### Step 7: Verify Security Groups

Ensure you have two properly configured security groups:

**ALB Security Group:**
- Inbound: HTTPS (443) from `0.0.0.0/0` (or your allowed IP ranges)
- Outbound: HTTP (8000) to Arc Security Group

**Arc Security Group:**
- Inbound: HTTP (8000) from ALB Security Group only
- Outbound: All traffic (or restrict as needed)

### Step 8: Verify Target Health

1. Go to **Target Groups** → `arc-target-group`
2. Click **Targets** tab
3. Wait for status to change from "initial" to "healthy"

If unhealthy, check:
- Security group allows port 8000 from ALB
- Arc is running: `sudo systemctl status arc`
- Health check path is correct: `/health`

### Step 9: Get Your Admin Token

SSH into your Arc instance through a bastion host or Session Manager:

```bash
# Using a bastion host (Ubuntu-based AMI)
ssh -i your-key.pem -J ubuntu@bastion-ip ubuntu@arc-private-ip

# Or use AWS Systems Manager Session Manager
aws ssm start-session --target i-your-instance-id

# Get the admin token
sudo journalctl -u arc | grep "Admin token"

# You'll see:
# Admin token: ark_abc123...xyz
```

### Step 10: Verify Deployment

Test the health endpoint through your ALB:

```bash
curl https://arc.yourdomain.com/health

# Expected: {"status":"healthy"}
```

Test ingestion using MessagePack columnar format:

```bash
export ARC_URL="https://arc.yourdomain.com"
export ARC_TOKEN="your-token-here"

# Write test data
echo '{"m":"cpu","columns":{"time":[1734372000000],"host":["server01"],"usage":[95.0]}}' | \
  python3 -c "import sys,msgpack,json; sys.stdout.buffer.write(msgpack.packb(json.load(sys.stdin)))" | \
  curl -X POST "$ARC_URL/api/v1/write/msgpack" \
    -H "Authorization: Bearer $ARC_TOKEN" \
    -H "Content-Type: application/msgpack" \
    -H "x-arc-database: default" \
    --data-binary @-

# Query it back
curl -X POST "$ARC_URL/api/v1/query" \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM default.cpu","format":"json"}'
```

## Instance Types

| Use Case | Instance Type | vCPU | Memory | Notes |
|----------|---------------|------|--------|-------|
| Testing | t3.large | 2 | 8 GB | Burstable, cost-effective |
| Small Production | m8a.xlarge | 4 | 16 GB | General purpose |
| Medium Production | m8a.2xlarge | 8 | 32 GB | Recommended |
| High Throughput | c7i.4xlarge | 16 | 32 GB | Compute optimized |

## Storage

Arc stores data in Parquet files on the EBS volume attached to the instance.

**Recommendations:**
- Use `gp3` volumes for best price/performance
- Size based on your data retention needs
- Enable EBS encryption for data at rest

```bash
# Check disk usage
df -h /app/data
```

## Pricing

| Component | Cost | Notes |
|-----------|------|-------|
| Arc Software | Free | AGPL-3.0 license |
| EC2 Instance | Variable | See [EC2 Pricing](https://aws.amazon.com/ec2/pricing/) |
| EBS Storage | ~$0.08/GB/month | gp3 pricing |
| ALB | ~$20/month | Plus data transfer |
| SSL Certificate | Free | AWS Certificate Manager |
| Enterprise Support | $500/month | Optional |

## Service Management

Arc runs as a systemd service on the AMI.

```bash
# Check status
sudo systemctl status arc

# View logs
sudo journalctl -u arc -f

# Restart service
sudo systemctl restart arc

# Stop service
sudo systemctl stop arc
```

## Troubleshooting

### Target Shows Unhealthy

1. Check Arc is running:
```bash
sudo systemctl status arc
```

2. Check Arc is listening on port 8000:
```bash
sudo ss -tlnp | grep 8000
```

3. Test health endpoint locally:
```bash
curl http://localhost:8000/health
```

4. Check security group allows traffic from ALB

### 504 Gateway Timeout

The ALB can't reach the Arc instance. Check:
- Security group allows port 8000 from ALB
- Arc instance is in the correct subnet
- Target group has the correct port (8000)

### Can't Find Admin Token

```bash
# Check all Arc logs
sudo journalctl -u arc | head -200

# Or search specifically
sudo journalctl -u arc | grep -i "admin\|token"
```

## Next Steps

- [Configure Telegraf integration](/arc-enterprise/integrations/telegraf)
- [Set up Grafana dashboards](/arc-enterprise/integrations/grafana)
- [Configure retention policies](/arc-enterprise/data-lifecycle/retention)
