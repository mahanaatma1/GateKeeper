# GateKeeper Backend

This is the backend service for the GateKeeper authentication system.

## Features

- User registration and authentication
- Email verification with OTP
- JWT-based authentication
- User profile management

## Technologies

- Node.js
- Express.js
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- bcrypt for password hashing

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- MongoDB (local instance or cloud)

### Installation

1. Clone the repository
2. Navigate to the backend directory: `cd backend`
3. Install dependencies: `npm install`
4. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/gatekeeper
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   EMAIL_USER=your_gmail_account@gmail.com
   EMAIL_PASSWORD=your_app_password
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   FRONTEND_URL=http://localhost:3000
   ```

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add a name for your OAuth client
7. Add the following Authorized redirect URIs:
   - `http://localhost:5000/api/auth/google/callback` (for development)
   - `https://yourdomain.com/api/auth/google/callback` (for production)
8. Click "Create"
9. Copy the generated Client ID and Client Secret
10. Paste them into your .env file as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

### Running the Server

- Development mode: `npm run dev`
- Build the project: `npm run build`
- Start production server: `npm start`

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── constants.ts     # API constants (routes, messages, etc.)
│   │   ├── db.ts            # Database configuration
│   │   ├── env.ts           # Environment variables configuration
│   │   ├── jwt.ts           # JWT configuration
│   │   └── index.ts         # Config exports
│   ├── controllers/         # Request handlers
│   ├── middlewares/         # Express middlewares
│   ├── models/              # Mongoose models
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic
│   ├── utils/               # Utility functions
│   └── server.ts            # Express app initialization
├── .env                     # Environment variables
├── package.json             # Project dependencies
└── tsconfig.json            # TypeScript configuration
```

## API Endpoints

### Authentication

#### Register a new user
- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "_id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "isVerified": false
      },
      "token": "jwt_token"
    }
  }
  ```

#### Login
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "john.doe@example.com",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "User logged in successfully",
    "data": {
      "user": {
        "_id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "isVerified": false
      },
      "token": "jwt_token"
    }
  }
  ```

### User Endpoints

#### Get Current User
- **URL**: `/api/users/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer your_token_here`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "isVerified": false
      }
    }
  }
  ```

#### Send OTP
- **URL**: `/api/users/send-otp`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "john.doe@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "otp": "123456", // Only in development mode
    "isNewUser": false
  }
  ```

## Development

This project uses nodemon for development, which will automatically restart the server on file changes.

## License

MIT 