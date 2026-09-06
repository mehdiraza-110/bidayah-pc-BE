const db = require('../config/db.config');

class ContactMessageService {
  // Create a new contact message (public "Contact Us" submission)
  async createContactMessage(data) {
    const result = await db.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [data.name, data.email, data.phone || null, data.subject || null, data.message]
    );

    return result.rows[0];
  }

  // Get all contact messages (admin inbox), optionally filtered to unread only
  async getAllContactMessages(filters = {}) {
    let query = `SELECT * FROM contact_messages`;

    if (filters.unreadOnly) {
      query += ` WHERE is_read = false`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query);

    return result.rows;
  }

  // Get contact message by ID
  async getContactMessageById(messageId) {
    const result = await db.query(
      `SELECT * FROM contact_messages WHERE id = $1`,
      [messageId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // Mark a message read/unread
  async setContactMessageRead(messageId, isRead) {
    const result = await db.query(
      `UPDATE contact_messages
       SET is_read = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [isRead, messageId]
    );

    if (result.rows.length === 0) {
      throw new Error('Contact message not found');
    }

    return result.rows[0];
  }

  // Delete a contact message
  async deleteContactMessage(messageId) {
    const result = await db.query(
      `DELETE FROM contact_messages WHERE id = $1 RETURNING id`,
      [messageId]
    );

    if (result.rows.length === 0) {
      throw new Error('Contact message not found');
    }

    return { message: 'Contact message deleted successfully', id: result.rows[0].id };
  }
}

module.exports = new ContactMessageService();
