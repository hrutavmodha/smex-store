# Bug: Missing MinIO Bucket Initialization Service in Production Compose

- **Bug ID**: BUG-OPS-002
- **Milestone**: Operations & Production Deployment
- **Severity**: High (P1 - Storage & Marketplace Proof Failure)
- **Target Files**:
  - `docker-compose.prod.yml` (lines 131–148)
  - `docker-compose.yml` (lines 59–74)
- **Status**: Identified

---

## 1. Description

In local development ([`docker-compose.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.yml)), MinIO is paired with a companion initialization container (`minio-init`):

```yaml
  minio-init:
    image: minio/mc:latest
    container_name: smex-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set localminio http://minio:9000 minioadmin minioadmin;
      /usr/bin/mc mb localminio/smex-storage --ignore-existing;
      /usr/bin/mc anonymous set download localminio/smex-storage;
      exit 0;
      "
    networks:
      - smex-network
```

This service ensures the target bucket (`smex-storage`) is provisioned and read access policies are applied on startup.

However, in [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml), the `minio` service is declared with an empty named volume (`smex_prod_minio_data`), but **`minio-init` is completely absent**:

```yaml
  minio:
    image: minio/minio:latest
    container_name: smex-minio-prod
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - smex_prod_minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - smex-prod-network
```

---

## 2. Impact

- On a new server deployment (such as a Hetzner VPS), the `smex_prod_minio_data` volume is created empty.
- Neither MinIO nor the Fastify backend automatically creates missing buckets on startup.
- When any user attempts to:
  1. Generate a presigned upload URL for a game account listing screenshot (`POST /api/v1/marketplace/uploads/presigned-url`),
  2. Verify upload magic bytes (`POST /api/v1/marketplace/uploads/verify`), or
  3. Retrieve listing proof images (`GET /api/v1/media/*`),
  the S3 SDK throws `NoSuchBucket: The specified bucket does not exist`.
- The marketplace proof upload system is completely non-functional out of the box.

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `docker-compose.prod.yml` lines 131–148.
2. Note the absence of `minio-init` or any bucket creation command.
3. Boot a fresh instance: `docker compose -f docker-compose.prod.yml up -d minio`.
4. Run `docker exec smex-minio-prod mc ls local/` -> outputs zero buckets.

---

## 4. Root Cause

The bucket initialization configuration was written in development compose (`docker-compose.yml`) but was never copied or adapted into production compose (`docker-compose.prod.yml`).

---

## 5. Recommended Remediation

Add the `minio-init` service to [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml):

```yaml
  minio-init:
    image: minio/mc:latest
    container_name: smex-minio-init-prod
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set localminio http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin};
      /usr/bin/mc mb localminio/smex-storage --ignore-existing;
      /usr/bin/mc anonymous set download localminio/smex-storage;
      exit 0;
      "
    networks:
      - smex-prod-network
```
