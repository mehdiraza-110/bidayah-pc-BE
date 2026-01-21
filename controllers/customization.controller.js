const customizationService = require('../services/customization.service');
const { uploadMediaToS3, deleteFromS3 } = require('../utils/s3.util');

class CustomizationController {
  // Create or update hero media
  async upsertHeroMedia(req, res) {
    try {
      // Parse media array from request body (could be JSON string or already parsed)
      let media = req.body.media;
      
      // If media is a string, parse it as JSON
      if (typeof media === 'string') {
        try {
          media = JSON.parse(media);
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            message: 'Invalid media JSON format'
          });
        }
      }
      
      // Validate media array
      if (!Array.isArray(media) || media.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Media array is required and must not be empty'
        });
      }
      
      if (media.length > 7) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 7 media items allowed (indices 0-6)'
        });
      }
      
      // Process each media item
      const processedMedia = [];
      
      for (let i = 0; i < media.length; i++) {
        const mediaItem = media[i];
        
        // Validate required fields
        if (mediaItem.index === undefined || mediaItem.index === null) {
          return res.status(400).json({
            success: false,
            message: `Index is required for media item at position ${i}`
          });
        }
        
        if (mediaItem.index < 0 || mediaItem.index > 6) {
          return res.status(400).json({
            success: false,
            message: `Index must be between 0 and 6 for media item at position ${i}`
          });
        }
        
        if (!mediaItem.type || !['image', 'video'].includes(mediaItem.type)) {
          return res.status(400).json({
            success: false,
            message: `Type must be 'image' or 'video' for media item at position ${i}`
          });
        }
        
        let mediaUrl = mediaItem.url;
        
        // If file is provided, upload it to S3
        if (req.files && req.files[`media_${i}`] && req.files[`media_${i}`][0]) {
          const file = req.files[`media_${i}`][0];
          
          // Validate file type based on media type
          if (mediaItem.type === 'image') {
            const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedImageTypes.includes(file.mimetype)) {
              return res.status(400).json({
                success: false,
                message: `Invalid image file type for media at index ${mediaItem.index}. Allowed types: JPEG, PNG, GIF, WebP`
              });
            }
          } else if (mediaItem.type === 'video') {
            const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
            if (!allowedVideoTypes.includes(file.mimetype)) {
              return res.status(400).json({
                success: false,
                message: `Invalid video file type for media at index ${mediaItem.index}. Allowed types: MP4, MPEG, MOV, AVI, WebM`
              });
            }
          }
          
          try {
            mediaUrl = await uploadMediaToS3(file, 'hero-media');
          } catch (uploadError) {
            console.error('Error uploading media to S3:', uploadError);
            return res.status(500).json({
              success: false,
              message: `Error uploading media file for index ${mediaItem.index}`,
              error: uploadError.message
            });
          }
        } else if (!mediaUrl) {
          return res.status(400).json({
            success: false,
            message: `Either URL or file is required for media at index ${mediaItem.index}`
          });
        }
        
        processedMedia.push({
          url: mediaUrl,
          type: mediaItem.type,
          index: parseInt(mediaItem.index)
        });
      }
      
      // Get existing media to delete old files from S3
      const existingMedia = await customizationService.getHeroMedia();
      const indicesToUpdate = processedMedia.map(m => m.index);
      const mediaToDelete = existingMedia.filter(m => indicesToUpdate.includes(m.index));
      
      // Upsert hero media
      const result = await customizationService.upsertHeroMedia(processedMedia);
      
      // Delete old files from S3
      for (const oldMedia of mediaToDelete) {
        if (oldMedia.url && oldMedia.url.startsWith('https://')) {
          try {
            await deleteFromS3(oldMedia.url);
          } catch (deleteError) {
            console.error('Error deleting old media from S3:', deleteError);
            // Don't fail the request if deletion fails
          }
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Hero media updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error updating hero media:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating hero media',
        error: error.message
      });
    }
  }
  
  // Get all hero media (public)
  async getHeroMedia(req, res) {
    try {
      const heroMedia = await customizationService.getHeroMedia();
      
      res.status(200).json({
        success: true,
        message: 'Hero media retrieved successfully',
        data: heroMedia
      });
    } catch (error) {
      console.error('Error fetching hero media:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching hero media',
        error: error.message
      });
    }
  }
}

module.exports = new CustomizationController();
