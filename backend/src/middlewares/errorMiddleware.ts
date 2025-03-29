import { Request, Response, NextFunction } from 'express';

// Error interface
interface ApiError extends Error {
  statusCode?: number;
  errors?: any;
}

// Global error handler middleware
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Set status code
  const statusCode = err.statusCode || 500;
  
  // Response object
  const response = {
    success: false,
    message: statusCode === 500 ? 'Server error' : err.message,
    errors: err.errors || undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  res.status(statusCode).json(response);
};

// Not found middleware
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  (error as ApiError).statusCode = 404;
  next(error);
};

// Export middleware
export default { errorHandler, notFound };
