import Redis from 'ioredis';

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { tls: {} })
  : new Redis({
      host: '127.0.0.1', // Localhost Redis
      port: 6379,
    });

export default redis;
