import { v2 as cloudinary } from 'cloudinary';
import { UploadApiOptions, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Interface for standardized upload results
interface CloudinaryUploadResult {
    success: boolean;
    url?: string;
    publicId?: string;
    format?: string;
    result?: UploadApiResponse;
    error?: string;
}

// Upload file from path
export const uploadToCloudinary = async (
    filePath: string,
    folder: string = 'user_uploads',
    options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
    try {
        const uploadResult = await cloudinary.uploader.upload(
            filePath, 
            {
                folder,
                ...options
            }
        );
        
        return {
            success: true,
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            format: uploadResult.format,
            result: uploadResult
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during upload'
        };
    }
};

// Upload buffer directly
export const uploadBufferToCloudinary = async (
    fileBuffer: Buffer,
    folder: string = 'user_uploads',
    options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> => {
    try {
        // Detect MIME type from buffer
        let contentType = 'image/png'; // Default
        if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
            contentType = 'image/jpeg';
        } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
            contentType = 'image/png';
        } else if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46) {
            contentType = 'image/gif';
        }
        
        // Convert buffer to base64 for Cloudinary
        const base64String = `data:${contentType};base64,${fileBuffer.toString('base64')}`;
        
        const uploadResult = await cloudinary.uploader.upload(
            base64String, 
            {
                folder,
                transformation: [
                    { width: 250, height: 250, crop: 'fill', gravity: 'face' }
                ],
                format: 'png',
                resource_type: 'image' as 'image',
                quality: 'auto',
                ...options
            }
        );
        
        return {
            success: true,
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            format: uploadResult.format,
            result: uploadResult
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during upload'
        };
    }
};

export default cloudinary;