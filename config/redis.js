import { logger } from '../utils/logger.js';

class InMemoryCache {
  constructor() {
    this.cache = new Map();
  }
  
  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  
  async set(key, value, ttlSeconds) {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
    if (expiry) {
      setTimeout(() => {
        if (this.cache.has(key) && this.cache.get(key).expiry === expiry) {
          this.cache.delete(key);
        }
      }, ttlSeconds * 1000).unref();
    }
    return true;
  }
  
  async del(key) {
    return this.cache.delete(key);
  }
}

let cacheClient;

export const connectCache = async () => {
  if (cacheClient) return cacheClient;
  
  if (process.env.REDIS_URL) {
    logger.warn('REDIS_URL provided, but redis client is not installed. Using in-memory fallback.', { url: process.env.REDIS_URL });
  }
  
  cacheClient = new InMemoryCache();
  logger.info('Initialized in-memory cache fallback');
  return cacheClient;
};

export const getCacheClient = () => {
  if (!cacheClient) throw new Error('Cache not initialized. Call connectCache first.');
  return cacheClient;
};

export const closeCache = async () => {
  if (cacheClient) {
    cacheClient.cache.clear();
    cacheClient = null;
    logger.info('Cache connection closed');
  }
};
