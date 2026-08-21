const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { authenticate, authorize } = require('../../middleware/auth');
const { ok, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./reports.service');

const router = express.Router();
router.use(authenticate);

const REPORTS = {
  'recruiter-performance': (q) => service.recruiterPerformance(q),
  'sales-performance': (q) => service.salesPerformance(q),
  'vendor-performance': (q) => service.vendorPerformance(q),
  aging: (q) => service.aging(q),
  closure: (q) => service.closure(q),
};

router.get(
  '/recruiter-performance',
  authorize('admin', 'sales', 'recruiter'),
  asyncHandler(async (req, res) => {
    const query = { ...req.query };
    // Recruiters only see their own row
    if (req.user.role === 'recruiter') query.recruiter_id = req.user.id;
    const data = await service.recruiterPerformance(query);
    return ok(res, data);
  })
);

router.get(
  '/sales-performance',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const data = await service.salesPerformance(req.query);
    return ok(res, data);
  })
);

router.get(
  '/vendor-performance',
  authorize('admin', 'sales'),
  asyncHandler(async (req, res) => {
    const data = await service.vendorPerformance(req.query);
    return ok(res, data);
  })
);

router.get(
  '/aging',
  authorize('admin', 'sales'),
  asyncHandler(async (req, res) => {
    const data = await service.aging(req.query);
    return ok(res, data);
  })
);

router.get(
  '/closure',
  authorize('admin', 'sales'),
  asyncHandler(async (req, res) => {
    const data = await service.closure(req.query);
    return ok(res, data);
  })
);

router.get(
  '/export',
  authorize('admin', 'sales'),
  asyncHandler(async (req, res) => {
    const { type, report } = req.query;
    const fn = REPORTS[report];
    if (!fn) return fail(res, 422, 'Unknown report');
    if (!['xlsx', 'pdf'].includes(type)) return fail(res, 422, 'type must be xlsx or pdf');

    const data = await fn(req.query);
    const rows = Array.isArray(data) ? data : [data];
    const filename = `${report}-${new Date().toISOString().slice(0, 7)}`;

    if (type === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(report);
      if (rows.length) {
        sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 22 }));
        rows.forEach((r) => sheet.addRow(flatten(r)));
        sheet.getRow(1).font = { bold: true };
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(16).text(report, { underline: true });
    doc.moveDown();
    rows.forEach((row, i) => {
      doc.fontSize(10).text(JSON.stringify(flatten(row), null, 2));
      if (i < rows.length - 1) doc.moveDown(0.5);
    });
    doc.end();
  })
);

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      if (v.name || v.id) {
        out[key] = v.name || v.id;
      } else {
        Object.assign(out, flatten(v, key));
      }
    } else if (Array.isArray(v)) {
      out[key] = v.length;
    } else {
      out[key] = v;
    }
  }
  return out;
}

module.exports = router;
