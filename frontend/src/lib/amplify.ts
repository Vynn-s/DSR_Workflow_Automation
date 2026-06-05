import { Amplify } from "aws-amplify";

const requiredEnvVars = [
  "VITE_COGNITO_USER_POOL_ID",
  "VITE_COGNITO_CLIENT_ID",
  "VITE_AWS_REGION",
] as const;

if (import.meta.env.DEV) {
  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      console.warn(`${envVar} is not defined`);
    }
  }
}

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION,
      loginWith: {
        email: true,
      },
    },
  },
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
