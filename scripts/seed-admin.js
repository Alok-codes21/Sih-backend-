/**
 * Admin Account Seed Script
 * 
 * Usage:
 *   node scripts/seed-admin.js
 * 
 * Creates the initial admin account. Run this ONCE after first deployment.
 * Requires ADMIN_EMAIL and ADMIN_PASSWORD environment variables.
 */
import dotenv from 'dotenv';
dotenv.config();

import { connectDb, closeDb } from '../config/db.js';
import { registerAdmin } from '../services/authService.js';

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.');
    process.exit(1);
  }

  try {
    await connectDb();
    const result = await registerAdmin({ email, password, name: 'System Administrator' });
    console.log(`✅ Admin account created successfully: ${result.user.email}`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Admin account already exists. No action needed.');
    } else {
      console.error('❌ Failed to create admin:', error.message);
    }
  } finally {
    await closeDb();
    process.exit(0);
  }
};

seedAdmin();
