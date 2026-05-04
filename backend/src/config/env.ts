import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
	port: string;
	nodeEnv: string;
	databaseUrl: string;
	cognitoUserPoolId: string;
	cognitoClientId: string;
	awsRegion: string;
	frontendUrl: string;
}

function requireEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

export const config: EnvConfig = {
	port: process.env.PORT || "3000",
	nodeEnv: process.env.NODE_ENV || "development",
	databaseUrl: requireEnv("DATABASE_URL"),
	cognitoUserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
	cognitoClientId: requireEnv("COGNITO_CLIENT_ID"),
	awsRegion: process.env.AWS_REGION || "ap-southeast-1",
	frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

export default config;
