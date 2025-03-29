import mongoose, { Schema, Document } from 'mongoose';

// OTP document interface
export interface IOTP extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

// OTP schema definition
const otpSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Auto delete after 10 minutes
  }
});

// Create and export OTP model
export default mongoose.model<IOTP>('OTP', otpSchema);
