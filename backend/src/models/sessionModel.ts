import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  expiresAt: Date;
}

const sessionSchema = new Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  lastActivity: { 
    type: Date, 
    required: true, 
    default: Date.now,
    index: true 
  },
  userAgent: { 
    type: String 
  },
  ip: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: true
  }
});

// Create index for automatic cleanup based on expiration date
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>('Session', sessionSchema); 