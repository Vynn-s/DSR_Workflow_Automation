# Deploying the backend to AWS Lightsail

This document contains a minimal, low-friction process to deploy the `backend` Node/Express app to an AWS Lightsail instance or container. It prefers a simple Docker-based flow so the app runs unmodified.

Prerequisites
- AWS account with Lightsail permissions
- Docker installed locally
- (Optional) Docker Hub account to host the image, or push directly to your Lightsail instance
- Your `backend/.env` configured with `DATABASE_URL`, `COGNITO_*`, and `FRONTEND_URL`

Steps — Build and test locally

1. From the `backend` folder build the Docker image locally:

```bash
cd backend
docker build -t your-dockerhub-username/cathedralflow-backend:latest .
```

2. Test run locally (reads env from `.env` — do not commit this file):

```bash
docker run --env-file .env -p 3000:3000 your-dockerhub-username/cathedralflow-backend:latest
# then open http://localhost:3000/health or your API routes
```

Steps — Push and deploy to Lightsail (Instance approach)

Option A — Lightsail instance (fast, predictable):

1. Push the image to Docker Hub:

```bash
docker push your-dockerhub-username/cathedralflow-backend:latest
```

2. Create a small Lightsail instance (Ubuntu) in the AWS console. SSH into it.

3. Install Docker on the instance (example for Ubuntu):

```bash
sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
newgrp docker
```

4. Pull & run the image on the instance, using environment variables stored in a file on the instance:

```bash
docker pull your-dockerhub-username/cathedralflow-backend:latest
scp .env ubuntu@<lightsail-ip>:/home/ubuntu/backend.env
docker run -d --restart unless-stopped --env-file /home/ubuntu/backend.env -p 3000:3000 --name cathedralflow your-dockerhub-username/cathedralflow-backend:latest
```

5. Configure the Lightsail firewall to open port 3000 (or use a reverse proxy like Nginx to expose 80/443 and route to 3000).

Option B — Lightsail Container Service (managed containers)

- Use the Lightsail console to create a container service and supply your container image (from Docker Hub or ECR). Configure environment variables in the service settings.

Domain, SSL, and CORS
- Point your frontend or API domain to the Lightsail instance IP (or container service endpoint). Update `FRONTEND_URL` in `backend/.env` and CORS settings if you change domains.
- For TLS, terminate TLS with an Nginx reverse proxy on the instance or use Lightsail load balancer / certificate options.

Snapshot & Pause (since you only need it for 2 months)

- Create an instance snapshot in Lightsail before deleting to pause billing for compute:

```bash
aws lightsail create-instance-snapshot --instance-name my-app --instance-snapshot-name my-app-snap
aws lightsail delete-instance --instance-name my-app
```

- For RDS, create a DB snapshot then delete the instance if you want to stop DB charges:

```bash
aws rds create-db-snapshot --db-instance-identifier mydb --db-snapshot-identifier mydb-snapshot
aws rds delete-db-instance --db-instance-identifier mydb --skip-final-snapshot false --final-db-snapshot-identifier mydb-final
```

Notes & troubleshooting
- If you keep RDS running in AWS, restrict the inbound security group to the Lightsail IP and your local IP while testing.
- If you see Prisma connection errors, ensure `DATABASE_URL` is reachable from the Lightsail instance and that SSL options match your database settings.

Want me to:
- create a `docker-compose` for local dev; or
- add a small `deploy.sh` script to build/push/pull; or
- generate an AWS CLI script to create a Lightsail instance and deploy the container automatically?
