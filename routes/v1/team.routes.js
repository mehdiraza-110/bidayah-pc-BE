const express = require('express');
const router = express.Router();
const teamController = require('../../controllers/team.controller');
const { upload } = require('../../config/multer.config');

const bannerImageUpload = upload.fields([{ name: 'image', maxCount: 1 }]);
const memberPhotoUpload = upload.fields([{ name: 'photo', maxCount: 1 }]);

// Banner (singleton)
router.get('/banner', teamController.getBanner.bind(teamController));
router.put('/banner', bannerImageUpload, teamController.upsertBanner.bind(teamController));
router.patch('/banner', bannerImageUpload, teamController.upsertBanner.bind(teamController));

// Team members
router.get('/members', teamController.getAllMembers.bind(teamController));
router.post('/members', memberPhotoUpload, teamController.createMember.bind(teamController));
router.put('/members/reorder', teamController.reorderMembers.bind(teamController));
router.put('/members/:id', memberPhotoUpload, teamController.updateMember.bind(teamController));
router.patch('/members/:id', memberPhotoUpload, teamController.updateMember.bind(teamController));
router.delete('/members/:id', teamController.deleteMember.bind(teamController));

module.exports = router;
