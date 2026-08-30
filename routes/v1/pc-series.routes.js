const express = require('express');
const router = express.Router();
const pcSeriesController = require('../../controllers/pcSeries.controller');
const { upload } = require('../../config/multer.config');

// hero_video is a plain URL field (not a file) — only card_image is an actual upload.
const seriesMediaUpload = upload.fields([{ name: 'card_image', maxCount: 1 }]);

// ---------- SERIES TYPES ----------
// (The flat GET /types list must be registered before GET /:id below, so
// "types" isn't swallowed as a series id — same rule as reorder vs :id.)

router.get('/types', pcSeriesController.getAllTypesForAdmin.bind(pcSeriesController));
router.post('/types', pcSeriesController.createType.bind(pcSeriesController));
router.put('/types/reorder', pcSeriesController.reorderTypes.bind(pcSeriesController));
router.put('/types/:id', pcSeriesController.updateType.bind(pcSeriesController));
router.delete('/types/:id', pcSeriesController.removeType.bind(pcSeriesController));

// ---------- SERIES ----------
// (Reorder is registered before /:id, for the same reason.)

router.get('/', pcSeriesController.getAllSeries.bind(pcSeriesController));
router.get('/:id', pcSeriesController.getSeriesById.bind(pcSeriesController));
router.post('/', seriesMediaUpload, pcSeriesController.createSeries.bind(pcSeriesController));
router.put('/reorder', pcSeriesController.reorderSeries.bind(pcSeriesController));
router.put('/:id', seriesMediaUpload, pcSeriesController.updateSeries.bind(pcSeriesController));
router.delete('/:id', pcSeriesController.removeSeries.bind(pcSeriesController));

module.exports = router;
