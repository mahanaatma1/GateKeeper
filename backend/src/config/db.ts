import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection string
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MongoDB URI is not defined in environment variables');
}

// Database connection function
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gatekeeper');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;