import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

import dns from 'dns';

let client;
let db;

export const connectDb = async () => {
  if (db) return db;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/athleteconnect';
  const dbName = process.env.MONGODB_DB_NAME || 'athleteconnect';
  
  // Set DNS servers to Google's public DNS in case local ISP/Windows blocks SRV lookup
  try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

  try {
    client = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 2 });
    await client.connect();
    db = client.db(dbName);
    logger.info('Connected to MongoDB', { dbName });
    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
};

export const getDb = () => {
  if (!db) throw new Error('Database not initialized. Call connectDb first.');
  return db;
};

export const closeDb = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
};
