const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const db = require('../../config/db');
const env = require('../../config/env');

const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.csv'];
const ALLOWED_ENTITIES = ['account', 'requirement', 'profile', 'submission'];

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  },
});

const router = express.Router();
router.use(authenticate);

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id, label } = req.body;
    if (!entity_type || !ALLOWED_ENTITIES.includes(entity_type)) return fail(res, 422, 'Invalid entity_type');
    if (!entity_id) return fail(res, 422, 'entity_id is required');
    if (!label) return fail(res, 422, 'label is required');
    if (!req.file) return fail(res, 422, 'file is required');

    const [row] = await db('documents')
      .insert({
        entity_type,
        entity_id,
        label,
        file_url: `/uploads/${req.file.filename}`,
        file_type: req.file.mimetype,
        file_size_bytes: req.file.size,
        uploaded_by: req.user.id,
      })
      .returning('*');

    const uploader = await db('users').select('id', 'name').where({ id: req.user.id }).first();
    return created(res, { ...row, uploaded_by: uploader });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.query;
    const query = db('documents');
    if (entity_type) query.where({ entity_type });
    if (entity_id) query.where({ entity_id });
    const rows = await query.orderBy('uploaded_at', 'desc');

    const userIds = [...new Set(rows.map((r) => r.uploaded_by))];
    const users = userIds.length ? await db('users').select('id', 'name').whereIn('id', userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return ok(res, rows.map((r) => ({ ...r, uploaded_by: userMap.get(r.uploaded_by) || null })));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await db('documents').where({ id: req.params.id }).first();
    if (!doc) return fail(res, 404, 'Not found');
    if (doc.uploaded_by !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'Not permitted');

    await db('documents').where({ id: req.params.id }).del();
    const filePath = path.join(env.uploadDir, path.basename(doc.file_url));
    fs.unlink(filePath, () => {});

    return ok(res, null, { message: 'Document deleted' });
  })
);

module.exports = router;
