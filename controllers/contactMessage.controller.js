const contactMessageService = require('../services/contactMessage.service');

class ContactMessageController {
  // Create a new contact message (public "Contact Us" submission)
  async createContactMessage(req, res) {
    try {
      const { name, email, phone, subject, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and message are required'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const newMessage = await contactMessageService.createContactMessage({ name, email, phone, subject, message });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: newMessage
      });
    } catch (error) {
      console.error('Error creating contact message:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending message',
        error: error.message
      });
    }
  }

  // Get all contact messages (admin inbox)
  async getAllContactMessages(req, res) {
    try {
      const filters = { unreadOnly: req.query.unread_only === 'true' };
      const messages = await contactMessageService.getAllContactMessages(filters);

      res.status(200).json({
        success: true,
        message: 'Contact messages retrieved successfully',
        data: messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Error fetching contact messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching contact messages',
        error: error.message
      });
    }
  }

  // Mark a message read/unread
  async setContactMessageRead(req, res) {
    try {
      const { id } = req.params;
      const { is_read } = req.body;

      if (typeof is_read !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'is_read (boolean) is required'
        });
      }

      const updatedMessage = await contactMessageService.setContactMessageRead(id, is_read);

      res.status(200).json({
        success: true,
        message: 'Contact message updated successfully',
        data: updatedMessage
      });
    } catch (error) {
      console.error('Error updating contact message:', error);

      if (error.message === 'Contact message not found') {
        return res.status(404).json({
          success: false,
          message: 'Contact message not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating contact message',
        error: error.message
      });
    }
  }

  // Delete a contact message
  async deleteContactMessage(req, res) {
    try {
      const { id } = req.params;
      const result = await contactMessageService.deleteContactMessage(id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id }
      });
    } catch (error) {
      console.error('Error deleting contact message:', error);

      if (error.message === 'Contact message not found') {
        return res.status(404).json({
          success: false,
          message: 'Contact message not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting contact message',
        error: error.message
      });
    }
  }
}

module.exports = new ContactMessageController();
