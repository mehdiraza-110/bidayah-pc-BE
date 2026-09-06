const express = require('express');
const router = express.Router();
const contactMessageController = require('../../controllers/contactMessage.controller');

// Public — the "Contact Us" page submits here
router.post('/', contactMessageController.createContactMessage.bind(contactMessageController));

// Admin inbox
router.get('/', contactMessageController.getAllContactMessages.bind(contactMessageController));

// Mark read/unread
router.patch('/:id/read', contactMessageController.setContactMessageRead.bind(contactMessageController));

// Delete
router.delete('/:id', contactMessageController.deleteContactMessage.bind(contactMessageController));

module.exports = router;
