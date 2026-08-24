const homepageSectionService = require('../services/homepageSection.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

// Loose validation for admin-entered colors — accepts hex (#fff, #ffffff),
// hsl()/hsla(), rgb()/rgba(), or a bare CSS color keyword (e.g. "transparent").
// Not trying to be a full CSS color parser, just enough to catch obvious junk.
const isValidColor = (value) =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ||
  /^(hsl|hsla|rgb|rgba)\([^)]+\)$/i.test(value) ||
  /^[a-z]+$/i.test(value);

class HomepageSectionController {
  async getAll(req, res) {
    try {
      const sections = await homepageSectionService.getAll();
      res.status(200).json({
        success: true,
        message: 'Homepage sections retrieved successfully',
        data: sections,
        count: sections.length,
      });
    } catch (error) {
      console.error('Error fetching homepage sections:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching homepage sections',
        error: error.message,
      });
    }
  }

  async getActiveForPublic(req, res) {
    try {
      const sections = await homepageSectionService.getActiveOrdered();
      res.status(200).json({
        success: true,
        message: 'Homepage sections retrieved successfully',
        data: sections,
        count: sections.length,
      });
    } catch (error) {
      console.error('Error fetching public homepage sections:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching homepage sections',
        error: error.message,
      });
    }
  }

  async create(req, res) {
    try {
      const { category_id, title, product_limit, is_active, bg_color_light, bg_color_dark } = req.body;

      if (!category_id) {
        return res.status(400).json({ success: false, message: 'category_id is required' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'title is required' });
      }
      if (bg_color_light && !isValidColor(bg_color_light)) {
        return res.status(400).json({ success: false, message: 'bg_color_light is not a valid CSS color' });
      }
      if (bg_color_dark && !isValidColor(bg_color_dark)) {
        return res.status(400).json({ success: false, message: 'bg_color_dark is not a valid CSS color' });
      }

      // Optional tile photo — either an uploaded file (multipart) or a plain
      // URL string passed straight through (no new file).
      const imageFile = req.files?.image?.[0] || req.file || null;
      let imageUrl = typeof req.body.image === 'string' ? req.body.image : null;

      if (imageFile) {
        try {
          imageUrl = await uploadToS3(imageFile, 'homepage-sections');
        } catch (uploadError) {
          console.error('Error uploading homepage section image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message,
          });
        }
      }

      const section = await homepageSectionService.create({
        category_id,
        title: title.trim(),
        product_limit,
        is_active,
        bg_color_light,
        bg_color_dark,
        image: imageUrl,
      });

      res.status(201).json({
        success: true,
        message: 'Homepage section created successfully',
        data: section,
      });
    } catch (error) {
      console.error('Error creating homepage section:', error);
      const isConflict = /unique/i.test(error.message) || error.code === '23505';
      res.status(isConflict ? 409 : 400).json({
        success: false,
        message: isConflict ? 'This category already has a homepage section' : (error.message || 'Error creating homepage section'),
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { bg_color_light, bg_color_dark } = req.body;

      if (bg_color_light && !isValidColor(bg_color_light)) {
        return res.status(400).json({ success: false, message: 'bg_color_light is not a valid CSS color' });
      }
      if (bg_color_dark && !isValidColor(bg_color_dark)) {
        return res.status(400).json({ success: false, message: 'bg_color_dark is not a valid CSS color' });
      }

      const currentSection = await homepageSectionService.getById(id);
      if (!currentSection) {
        return res.status(404).json({ success: false, message: 'Homepage section not found' });
      }

      const updateData = { ...req.body };

      // A plain URL string for image (no new file, and not an explicit clear) is
      // passed straight through — only reachable when req.body.image is itself a
      // string, since multipart file uploads land in req.files instead.
      const imageFile = req.files?.image?.[0] || req.file || null;

      if (imageFile) {
        try {
          const newImageUrl = await uploadToS3(imageFile, 'homepage-sections');
          if (currentSection.image) {
            try {
              await deleteFromS3(currentSection.image);
            } catch (deleteError) {
              console.error('Error deleting old homepage section image from S3:', deleteError);
              // Continue even if deletion fails — the new image is already live.
            }
          }
          updateData.image = newImageUrl;
        } catch (uploadError) {
          console.error('Error uploading homepage section image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message,
          });
        }
      } else if (req.body.image === '' || req.body.image === null) {
        // Explicit clear — admin removed the image without picking a new one.
        if (currentSection.image) {
          try {
            await deleteFromS3(currentSection.image);
          } catch (deleteError) {
            console.error('Error deleting removed homepage section image from S3:', deleteError);
          }
        }
        updateData.image = null;
      }

      const section = await homepageSectionService.update(id, updateData);

      if (!section) {
        return res.status(404).json({ success: false, message: 'Homepage section not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Homepage section updated successfully',
        data: section,
      });
    } catch (error) {
      console.error('Error updating homepage section:', error);
      const isConflict = /unique/i.test(error.message) || error.code === '23505';
      res.status(isConflict ? 409 : 400).json({
        success: false,
        message: isConflict ? 'This category already has a homepage section' : (error.message || 'Error updating homepage section'),
      });
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params;
      const existing = await homepageSectionService.getById(id);

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Homepage section not found' });
      }

      await homepageSectionService.delete(id);

      if (existing.image) {
        try {
          await deleteFromS3(existing.image);
        } catch (deleteError) {
          console.error('Error deleting homepage section image from S3:', deleteError);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Homepage section deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting homepage section:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting homepage section',
        error: error.message,
      });
    }
  }

  async reorder(req, res) {
    try {
      const { sections } = req.body;

      if (!Array.isArray(sections)) {
        return res.status(400).json({ success: false, message: 'sections must be an array' });
      }

      const updated = await homepageSectionService.reorder(sections);

      res.status(200).json({
        success: true,
        message: 'Homepage section order updated successfully',
        data: updated,
      });
    } catch (error) {
      console.error('Error reordering homepage sections:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error reordering homepage sections',
      });
    }
  }
}

module.exports = new HomepageSectionController();
