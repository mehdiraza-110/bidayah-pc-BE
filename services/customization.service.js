const db = require('../config/db.config');

class CustomizationService {
  // Create or update hero media
  async upsertHeroMedia(mediaArray) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Validate indices (0-6)
      const indices = mediaArray.map(m => m.index);
      if (indices.some(idx => idx < 0 || idx > 6)) {
        throw new Error('Display index must be between 0 and 6');
      }
      
      // Check for duplicate indices
      const uniqueIndices = new Set(indices);
      if (uniqueIndices.size !== indices.length) {
        throw new Error('Duplicate display indices are not allowed');
      }
      
      // Delete existing media at these indices
      for (const media of mediaArray) {
        await client.query(
          'DELETE FROM hero_media WHERE display_index = $1',
          [media.index]
        );
      }
      
      // Insert new media
      const insertedMedia = [];
      for (const media of mediaArray) {
        if (!media.url) {
          throw new Error(`URL is required for media at index ${media.index}`);
        }
        if (!['image', 'video'].includes(media.type)) {
          throw new Error(`Invalid media type for index ${media.index}. Must be 'image' or 'video'`);
        }
        
        const result = await client.query(
          `INSERT INTO hero_media (url, type, display_index, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [media.url, media.type, media.index]
        );
        
        insertedMedia.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      // Return all hero media sorted by index
      return await this.getHeroMedia();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get all hero media (sorted by display_index)
  async getHeroMedia() {
    try {
      const result = await db.query(
        `SELECT id, url, type, display_index, created_at, updated_at
         FROM hero_media
         ORDER BY display_index ASC`
      );
      
      return result.rows.map(row => ({
        id: row.id,
        url: row.url,
        type: row.type,
        index: row.display_index,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      throw error;
    }
  }
  
  // Delete hero media by index
  async deleteHeroMediaByIndex(index) {
    try {
      const result = await db.query(
        'DELETE FROM hero_media WHERE display_index = $1 RETURNING *',
        [index]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Hero media not found at the specified index');
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // Delete all hero media
  async deleteAllHeroMedia() {
    try {
      await db.query('DELETE FROM hero_media');
      return { message: 'All hero media deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CustomizationService();
