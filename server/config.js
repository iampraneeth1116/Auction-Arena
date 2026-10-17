import './env.js';

const isProduction = process.env.NODE_ENV === 'production';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
};

required('DATABASE_URL');

const jwtSecret = required('JWT_SECRET');
if (isProduction && jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  jwtSecret,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
};
