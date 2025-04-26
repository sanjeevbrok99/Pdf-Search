import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost', // Redis host
  port: parseInt(process.env.REDIS_PORT || '6379', 10), // Redis port
});

export default redis;
