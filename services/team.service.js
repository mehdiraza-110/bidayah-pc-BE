const db = require('../config/db.config');

class TeamService {
  // ===== Banner (singleton) =====

  async getBanner() {
    const result = await db.query(
      `SELECT * FROM team_page_banner ORDER BY created_at ASC LIMIT 1`
    );

    return result.rows[0] || null;
  }

  // Create or update the banner — enforces a single row
  async upsertBanner(data) {
    const existing = await db.query('SELECT id FROM team_page_banner LIMIT 1');

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE team_page_banner SET
           image_url = $1,
           heading = $2,
           subtext = $3,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [data.image_url, data.heading, data.subtext, existing.rows[0].id]
      );
      return result.rows[0];
    }

    const result = await db.query(
      `INSERT INTO team_page_banner (image_url, heading, subtext, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [data.image_url, data.heading, data.subtext]
    );
    return result.rows[0];
  }

  // ===== Team members =====

  // Admin list — every member, however many are active/inactive.
  async getAllMembers() {
    const result = await db.query(
      `SELECT * FROM team_members ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows;
  }

  // Public list — active members only, ordered for display.
  async getActiveMembers() {
    const result = await db.query(
      `SELECT * FROM team_members WHERE is_active = true ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows;
  }

  async getMemberById(memberId) {
    const result = await db.query(
      `SELECT * FROM team_members WHERE id = $1`,
      [memberId]
    );
    return result.rows[0] || null;
  }

  async createMember(data) {
    const orderResult = await db.query(
      `SELECT COALESCE(MAX(display_order) + 1, 0) AS next_order FROM team_members`
    );
    const displayOrder = data.display_order ?? orderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO team_members (name, role, bio, photo_url, display_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.name,
        data.role,
        data.bio || null,
        data.photo_url || null,
        displayOrder,
        data.is_active !== undefined ? data.is_active : true,
      ]
    );
    return result.rows[0];
  }

  async updateMember(memberId, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const assignable = ['name', 'role', 'bio', 'photo_url', 'display_order', 'is_active'];
    for (const key of assignable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${i}`);
        values.push(data[key]);
        i++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(memberId);
    const result = await db.query(
      `UPDATE team_members SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Team member not found');
    }

    return result.rows[0];
  }

  async deleteMember(memberId) {
    const result = await db.query(
      `DELETE FROM team_members WHERE id = $1 RETURNING id, name, photo_url`,
      [memberId]
    );

    if (result.rows.length === 0) {
      throw new Error('Team member not found');
    }

    return result.rows[0];
  }

  async reorderMembers(items = []) {
    if (!Array.isArray(items)) throw new Error('items must be an array');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id) throw new Error('Each item requires an id');
        await client.query(
          `UPDATE team_members SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [item.display_order ?? i, item.id]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.getAllMembers();
  }
}

module.exports = new TeamService();
