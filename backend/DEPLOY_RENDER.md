# Deploying the backend to Render

This backend is already Dockerized, so moving it to Render is mostly a matter of creating a Render Web Service and copying over the same environment variables.

## What stays the same

- The backend code and Dockerfile stay the same.
- The API still serves on `/api` and health checks on `/api/health`.
- The frontend still points to the backend through `VITE_API_URL`.

## Render setup

1. Push this repo to GitHub if it is not already there.
2. In Render, create a new Web Service from the repository.
3. Use the `render.yaml` blueprint at the repository root, or create the service manually with:
   - Environment: `Docker`
   - Root directory: `DSR_Workflow_Automation/backend`
   - Health check path: `/api/health`
4. Set these environment variables in the Render dashboard:
   - `DATABASE_URL`
   - `COGNITO_USER_POOL_ID`
   - `COGNITO_CLIENT_ID`
   - `AWS_REGION`
   - `FRONTEND_URL` = `https://dsr-workflow-automation-frontend.vercel.app`
   - `NODE_ENV` = `production`
   - `AWS_ACCESS_KEY_ID` = AWS IAM access key that can delete Cognito users
   - `AWS_SECRET_ACCESS_KEY` = matching AWS IAM secret key

   The Cognito credentials are required for admin user deletes to sync from the backend to Cognito. Without them, the database delete will succeed but Cognito will not be updated.

## After deployment

1. Copy the Render service URL.
2. Update the Vercel frontend env var:
   - `VITE_API_URL = https://<your-render-service>.onrender.com/api`
3. Redeploy the frontend.
4. Test login and the requests page again.

## When to stop using Lightsail

Once Render is serving the API correctly and the frontend works against it, you can stop the Lightsail container. Keep it around until Render is confirmed, then shut it down to avoid extra cost.