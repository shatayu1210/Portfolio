const cloudinary = require('../config/cloudinary');

const uploadImage = async (file, folder = '') => {
    try {
        // Check if we have a tempFilePath (from express-fileupload with useTempFiles: true)
        if (file.tempFilePath) {
            // Use the temporary file path directly
            const result = await cloudinary.uploader.upload(file.tempFilePath, {
                folder: folder,
                use_filename: true,
                unique_filename: true,
            });
            return result.secure_url;
        } else if (file.data) {
            // Fallback to using the buffer data if available
            const fileStr = `data:${file.mimetype};base64,${file.data.toString('base64')}`;
            
            const result = await cloudinary.uploader.upload(fileStr, {
                folder: folder,
                use_filename: true,
                unique_filename: true,
            });
            return result.secure_url;
        } else {
            throw new Error('Invalid file format');
        }
    } catch (error) {
        console.error('Error uploading to cloudinary:', error);
        throw new Error('Error uploading image');
    }
};

module.exports = {
    uploadImage,
    DEFAULT_PROFILE_IMAGE: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1744050200/profile_placeholder.png',
    DEFAULT_RESTAURANT_IMAGE: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png',
    DEFAULT_DISH_IMAGE: 'https://res.cloudinary.com/dvylvq84d/image/upload/v1744151036/ImagePlaceholder_gg1xob.png'
}; 