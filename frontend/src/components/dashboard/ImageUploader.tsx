import React, { useState, useRef, useEffect } from 'react';
import { userAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

// Simple Avatar component with built-in error handling
const UserAvatar = ({ 
  imageUrl, 
  size = 48, 
  className = "" 
}: { 
  imageUrl: string, 
  size?: number, 
  className?: string 
}) => {
  const [imgSrc, setImgSrc] = useState(imageUrl);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    setImgSrc(imageUrl);
    setHasError(false);
  }, [imageUrl]);
  
  const handleError = () => {
    console.error('Avatar image failed to load:', imgSrc);
    
    if (imgSrc === imageUrl) {
      // Try with proxy if original fails
      const proxyUrl = `/api/users/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      console.log('Trying proxy URL for avatar:', proxyUrl);
      setImgSrc(proxyUrl);
    } else if (!hasError) {
      // If proxy also fails, use placeholder
      setHasError(true);
      setImgSrc("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAMAAAC/MqoPAAAAGFBMVEX///8AAAD5+fm0tLSqqqrw8PDT09Pp6emN1D3ZAAABK0lEQVR4nO3aS3LCQAwFwbFhg+5/YrIhG1cSAsObbp5dTX3DT08AAAAAAAAAAAAAAAAAAADAX+v96/sA69bL82O+Db5urKvb5JvAXrVX9dvAlnXrNPs2tM7mnx43/QGwe12Pw7eudztc+3Gfcdb5eHGf9GHdzmGfDH6/kp3/+nmo2uTqPl/n08K+PGvK3a3nf3Y7hV/j9g7fD0/2/cPuFvC60G84/IbDW2i5/f8lvP5o1vvqAQAAAAAAAAAAAFzuUYNbf6pnnt1/qsMed7XXK3t01fuj/i1gr1rn009+Xdb19Tf5t3v1NPttn9a6TX5b12Pl7l63p7XfXeu+fvdbdwAAAAAAAAAAAAAAAAAAwF/6ARfTFI4i7KHXAAAAAElFTkSuQmCC");
    }
  };
  
  return (
    <div 
      className={`overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={imgSrc}
        alt="User Avatar"
        className="w-full h-full object-cover"
        onError={handleError}
        crossOrigin="anonymous"
      />
    </div>
  );
};

interface ImageUploaderProps {
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onSuccess, onError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, setUser } = useAuth();

  // Initialize preview URL from user's existing profile image
  useEffect(() => {
    if (user?.profileImage) {
      setPreviewUrl(user.profileImage);
    }
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    handleFile(files[0]);
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, etc.)');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    // Clear previous errors
    setError(null);
    
    // Create local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    
    // Upload the file
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await userAPI.uploadProfileImage(file);
      
      // Extract image URL from response
      let imageUrl = null;
      const anyResult = result as any;
      
      if (anyResult.url) {
        imageUrl = anyResult.url;
      } else if (anyResult.profileImage) {
        imageUrl = anyResult.profileImage;
      } else if (anyResult.data?.url) {
        imageUrl = anyResult.data.url;
      }
      
      if (imageUrl) {
        // Update preview with server URL
        setPreviewUrl(imageUrl);
        
        // Update user context with new image URL
        if (setUser && user) {
          setUser({
            ...user,
            profileImage: imageUrl
          });
        }
        
        if (onSuccess) {
          onSuccess(imageUrl);
        }
      } else {
        throw new Error('No image URL found in server response');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Failed to upload image');
      if (onError) {
        onError(err.message || 'Failed to upload image');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        className={`relative w-32 h-32 rounded-full overflow-hidden border-2 cursor-pointer ${
          isUploading ? 'opacity-70' : ''
        }`}
        onClick={triggerFileInput}
      >
        {previewUrl ? (
          <img 
            src={previewUrl}
            alt="Profile" 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Simple error fallback - use a placeholder if image fails to load
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='60' r='50' fill='%23e2e8f0'/%3E%3Cpath d='M60 30 C 42 30 30 45 30 60 C 30 75 45 90 60 90 C 75 90 90 75 90 60 C 90 45 78 30 60 30 Z M 60 40 C 65 40 70 45 70 50 C 70 55 65 60 60 60 C 55 60 50 55 50 50 C 50 45 55 40 60 40 Z M 42 82 C 44 74 52 68 60 68 C 68 68 76 74 78 82 C 73 86 67 88 60 88 C 53 88 47 86 42 82 Z' fill='%23cbd5e1'/%3E%3C/svg%3E";
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <button
        onClick={triggerFileInput}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        disabled={isUploading}
      >
        {isUploading ? 'Uploading...' : 'Change photo'}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUploader; 