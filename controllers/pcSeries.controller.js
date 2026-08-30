const pcSeriesService = require('../services/pcSeries.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

const toBool = (value, fallback) => (value !== undefined ? (value === 'true' || value === true) : fallback);

class PcSeriesController {
  // ---------- SERIES ----------

  async getAllSeries(req, res) {
    try {
      const rows = await pcSeriesService.series.getAll();
      res.status(200).json({ success: true, message: 'PC series retrieved successfully', data: rows, count: rows.length });
    } catch (error) {
      console.error('Error fetching PC series:', error);
      res.status(500).json({ success: false, message: 'Error fetching PC series', error: error.message });
    }
  }

  async getSeriesById(req, res) {
    try {
      const row = await pcSeriesService.series.getById(req.params.id, false);
      if (!row) return res.status(404).json({ success: false, message: 'PC series not found' });
      res.status(200).json({ success: true, message: 'PC series retrieved successfully', data: row });
    } catch (error) {
      console.error('Error fetching PC series:', error);
      res.status(500).json({ success: false, message: 'Error fetching PC series', error: error.message });
    }
  }

  async getActiveSeriesForPublic(req, res) {
    try {
      const rows = await pcSeriesService.series.getActiveOrdered();
      res.status(200).json({ success: true, message: 'PC series retrieved successfully', data: rows, count: rows.length });
    } catch (error) {
      console.error('Error fetching public PC series:', error);
      res.status(500).json({ success: false, message: 'Error fetching PC series', error: error.message });
    }
  }

  async getSeriesBySlugForPublic(req, res) {
    try {
      const row = await pcSeriesService.series.getBySlug(req.params.slug, true);
      if (!row || !row.is_active) return res.status(404).json({ success: false, message: 'PC series not found' });
      res.status(200).json({ success: true, message: 'PC series retrieved successfully', data: row });
    } catch (error) {
      console.error('Error fetching public PC series:', error);
      res.status(500).json({ success: false, message: 'Error fetching PC series', error: error.message });
    }
  }

  async createSeries(req, res) {
    try {
      const { name, action_button_text, badge_status } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'name is required' });
      }

      let cardImageUrl;
      try {
        if (req.files?.card_image?.[0]) {
          cardImageUrl = await uploadToS3(req.files.card_image[0], 'pc-series/cards');
        }
      } catch (uploadError) {
        console.error('Error uploading PC series media to S3:', uploadError);
        return res.status(500).json({ success: false, message: 'Error uploading media to S3', error: uploadError.message });
      }

      const row = await pcSeriesService.series.create({
        name,
        action_button_text,
        badge_status,
        is_active: toBool(req.body.is_active, true),
        card_image: cardImageUrl,
        // A plain URL (e.g. YouTube/Vimeo/CDN link) — not uploaded, unlike card_image.
        hero_video: req.body.hero_video?.trim() || undefined,
        card_description: req.body.card_description,
        starting_price: req.body.starting_price !== undefined && req.body.starting_price !== '' ? parseFloat(req.body.starting_price) : undefined,
        ending_price: req.body.ending_price !== undefined && req.body.ending_price !== '' ? parseFloat(req.body.ending_price) : undefined,
        is_custom_build: toBool(req.body.is_custom_build, false)
      });

      res.status(201).json({ success: true, message: 'PC series created successfully', data: row });
    } catch (error) {
      console.error('Error creating PC series:', error);
      res.status(400).json({ success: false, message: error.message || 'Error creating PC series' });
    }
  }

  async updateSeries(req, res) {
    try {
      const { id } = req.params;
      const current = await pcSeriesService.series.getById(id, false);
      if (!current) return res.status(404).json({ success: false, message: 'PC series not found' });

      const { name, action_button_text, badge_status } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (action_button_text !== undefined) updateData.action_button_text = action_button_text;
      if (badge_status !== undefined) updateData.badge_status = badge_status;
      if (req.body.is_active !== undefined) updateData.is_active = toBool(req.body.is_active, true);
      if (req.body.card_description !== undefined) updateData.card_description = req.body.card_description || null;
      if (req.body.starting_price !== undefined) {
        updateData.starting_price = req.body.starting_price === '' ? null : parseFloat(req.body.starting_price);
      }
      if (req.body.ending_price !== undefined) {
        updateData.ending_price = req.body.ending_price === '' ? null : parseFloat(req.body.ending_price);
      }
      if (req.body.is_custom_build !== undefined) updateData.is_custom_build = toBool(req.body.is_custom_build, false);
      // A plain URL, not an upload — no S3 cleanup needed (see createSeries).
      if (req.body.hero_video !== undefined) updateData.hero_video = req.body.hero_video.trim() || null;

      try {
        if (req.files?.card_image?.[0]) {
          updateData.card_image = await uploadToS3(req.files.card_image[0], 'pc-series/cards');
          if (current.card_image) {
            deleteFromS3(current.card_image).catch(e => console.error('Error deleting old PC series card image:', e));
          }
        }
      } catch (uploadError) {
        console.error('Error uploading PC series media to S3:', uploadError);
        return res.status(500).json({ success: false, message: 'Error uploading media to S3', error: uploadError.message });
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      const row = await pcSeriesService.series.update(id, updateData);
      res.status(200).json({ success: true, message: 'PC series updated successfully', data: row });
    } catch (error) {
      console.error('Error updating PC series:', error);
      res.status(400).json({ success: false, message: error.message || 'Error updating PC series' });
    }
  }

  async removeSeries(req, res) {
    try {
      const deleted = await pcSeriesService.series.delete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'PC series not found' });

      // hero_video is a plain external URL now (not an S3 upload) — nothing to clean up there.
      if (deleted.card_image) deleteFromS3(deleted.card_image).catch(e => console.error('Error deleting PC series card image:', e));

      res.status(200).json({ success: true, message: 'PC series deleted successfully' });
    } catch (error) {
      console.error('Error deleting PC series:', error);
      res.status(500).json({ success: false, message: 'Error deleting PC series', error: error.message });
    }
  }

  async reorderSeries(req, res) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ success: false, message: 'items must be an array' });
      const updated = await pcSeriesService.series.reorder(items);
      res.status(200).json({ success: true, message: 'PC series order updated successfully', data: updated });
    } catch (error) {
      console.error('Error reordering PC series:', error);
      res.status(400).json({ success: false, message: error.message || 'Error reordering PC series' });
    }
  }

  // ---------- SERIES TYPES ----------

  async createType(req, res) {
    try {
      const row = await pcSeriesService.types.create(req.body);
      res.status(201).json({ success: true, message: 'Series type created successfully', data: row });
    } catch (error) {
      console.error('Error creating series type:', error);
      res.status(400).json({ success: false, message: error.message || 'Error creating series type' });
    }
  }

  async updateType(req, res) {
    try {
      const row = await pcSeriesService.types.update(req.params.id, req.body);
      if (!row) return res.status(404).json({ success: false, message: 'Series type not found' });
      res.status(200).json({ success: true, message: 'Series type updated successfully', data: row });
    } catch (error) {
      console.error('Error updating series type:', error);
      res.status(400).json({ success: false, message: error.message || 'Error updating series type' });
    }
  }

  async removeType(req, res) {
    try {
      const deleted = await pcSeriesService.types.delete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Series type not found' });
      res.status(200).json({ success: true, message: 'Series type deleted successfully' });
    } catch (error) {
      console.error('Error deleting series type:', error);
      res.status(500).json({ success: false, message: 'Error deleting series type', error: error.message });
    }
  }

  async reorderTypes(req, res) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ success: false, message: 'items must be an array' });
      await pcSeriesService.types.reorder(items);
      res.status(200).json({ success: true, message: 'Series type order updated successfully' });
    } catch (error) {
      console.error('Error reordering series types:', error);
      res.status(400).json({ success: false, message: error.message || 'Error reordering series types' });
    }
  }


  // Flat list of every series type across every series (with its parent
  // series name attached) — powers the "Series Type" picker on the Featured
  // Gaming PC form.
  async getAllTypesForAdmin(req, res) {
    try {
      const rows = await pcSeriesService.types.getAllFlat();
      res.status(200).json({ success: true, message: 'Series types retrieved successfully', data: rows, count: rows.length });
    } catch (error) {
      console.error('Error fetching series types:', error);
      res.status(500).json({ success: false, message: 'Error fetching series types', error: error.message });
    }
  }
}

module.exports = new PcSeriesController();
