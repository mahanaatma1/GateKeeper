import mongoose, { Document, Schema } from 'mongoose';

// User document interface
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  googleId?: string;
  githubId?: string;
  linkedinId?: string;
  facebookId?: string;
}

// Schema definition
const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters']
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationCode: {
      type: String
    },
    verificationCodeExpires: {
      type: Date
    },
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true
    },
    githubId: {
      type: String,
      sparse: true,
      unique: true
    },
    linkedinId: {
      type: String,
      sparse: true,
      unique: true
    },
    facebookId: {
      type: String,
      sparse: true,
      unique: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IUser>('User', userSchema);