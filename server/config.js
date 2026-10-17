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

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
};
