// scripts/report.js
// Fastify route registration for reports

const dbFunctions = require('./database.js');

// small helpers (sanitize, validate, timestamp)
function clean(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

function now() {
  return new Date().toISOString();
}

function isValidType(type) {
  const validTypes = ['vending_machine', 'location', 'app_functionality', 'other'];
  return validTypes.includes(type);
}

function validateReportPayload(payload) {
  if (!payload) return false;
  const { building_id, title, description, type } = payload;
  if (building_id === undefined || building_id === null) return false;
  if (typeof title !== 'string' || title.trim() === '') return false;
  if (typeof description !== 'string') return false;
  if (typeof type !== 'string' || !isValidType(type)) return false;
  return true;
}

const routes = (fastify, options, done) => {

  // POST /report
  fastify.post('/report', async (request, reply) => {
    // destructure and sanitize input
    let { building_id, title, description, type } = request.body || {};
    title = clean(title);
    description = clean(description);

    // normalize building_id (may be string in JSON) -> integer
    if (building_id !== undefined && building_id !== null) {
      building_id = Number(building_id);
    }

    // validate payload after sanitization
    if (!validateReportPayload({ building_id, title, description, type })) {
      return reply.code(400).send({ success: false, error: 'Invalid report format.' });
    }

    // length limits
    if (title.length > 100) {
      return reply.code(400).send({ success: false, error: 'Title exceeds 100 characters.' });
    }
    if (description.length > 1000) {
      return reply.code(400).send({ success: false, error: 'Description exceeds allowed length.' });
    }

    try {
      const result = await dbFunctions.addReport(building_id, title, description, type);
      const timestamp = now();
      fastify.log.info(`[REPORT CREATED] ${timestamp} | ${title} | ${description}`);

      return reply.code(201).send({
        success: true,
        message: 'Report successfully created and logged.',
        id: result?.id || null,
        timestamp
      });
    } catch (err) {
      fastify.log.error('Failed to insert report:', err);
      return reply.code(500).send({ success: false, error: 'Failed to insert new report object.' });
    }
  });

  // GET /reports (paginated optional)
  fastify.get('/reports', async (request, reply) => {
    try {
      const reports = await dbFunctions.getAllReports();
      return reply.code(200).send({ success: true, count: reports.length, data: reports });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to retrieve reports from the database.' });
    }
  });

  // GET /reports/building/:building_id
  fastify.get('/reports/building/:building_id', async (request, reply) => {
    const building_id = Number(request.params.building_id);
    if (Number.isNaN(building_id)) {
      return reply.code(400).send({ success: false, error: 'Invalid building_id.' });
    }
    try {
      const reports = await dbFunctions.getReportsByBuilding(building_id);
      return reply.code(200).send({ success: true, building_id, count: reports.length, data: reports });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to retrieve reports for this building.' });
    }
  });

  // GET /reports/type/:type
  fastify.get('/reports/type/:type', async (request, reply) => {
    const type = request.params.type;
    if (!isValidType(type)) {
      return reply.code(400).send({ success: false, error: `Invalid report type. Valid types: vending_machine, location, app_functionality, other` });
    }
    try {
      const reports = await dbFunctions.getReportsByType(type);
      return reply.code(200).send({ success: true, count: reports.length, type, data: reports });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to retrieve filtered reports from the database.' });
    }
  });

  // GET /reports/count
  fastify.get('/reports/count', async (request, reply) => {
    try {
      const total = await dbFunctions.getReportCount();
      return reply.code(200).send({ success: true, total_reports: total });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to get report count.' });
    }
  });

  // GET /reports/stats
  fastify.get('/reports/stats', async (request, reply) => {
    try {
      const stats = await dbFunctions.getReportStats();
      return reply.code(200).send({ success: true, total_reports: stats.total, by_type: stats.byType });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to retrieve report statistics.' });
    }
  });

  // GET /reports/recent
  fastify.get('/reports/recent', async (request, reply) => {
    try {
      const reports = await dbFunctions.getRecentReports();
      return reply.code(200).send({ success: true, count: reports.length, data: reports });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to retrieve recent reports.' });
    }
  });

  // PATCH /reports/:id/description
  fastify.patch('/reports/:id/description', async (request, reply) => {
    const id = Number(request.params.id);
    const { description } = request.body || {};
    if (!description || description.length > 1000) {
      return reply.code(400).send({ success: false, error: 'Invalid description.' });
    }
    try {
      const ok = await dbFunctions.updateReportDescription(id, description);
      if (!ok) return reply.code(404).send({ success: false, error: 'Report not found.' });
      return reply.code(200).send({ success: true, message: 'Description updated.' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to update description.' });
    }
  });

  // DELETE /reports/:id
  fastify.delete('/reports/:id', async (request, reply) => {
    const id = Number(request.params.id);
    try {
      const ok = await dbFunctions.deleteReport(id);
      if (!ok) return reply.code(404).send({ success: false, error: 'Report not found.' });
      return reply.code(200).send({ success: true, message: 'Report deleted.' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to delete report.' });
    }
  });

  // GET /reports/search?query=...
  fastify.get('/reports/search', async (request, reply) => {
    const { query } = request.query || {};
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return reply.code(400).send({ success: false, error: 'Query must be at least 2 characters.' });
    }
    try {
      const results = await dbFunctions.searchReports(query.trim());
      return reply.code(200).send({ success: true, count: results.length, data: results });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: 'Failed to perform search.' });
    }
  });

  // Health check
  fastify.get("/health", async (request, reply) => {
    reply.code(200).send({
      status: "ok",
      server: "Fastify backend running",
      timestamp: new Date().toISOString()
    });
  });

  // API version
  fastify.get("/version", async (request, reply) => {
    reply.code(200).send({
      api_version: "1.0.0",
      description: "MunchiMaps backend API"
    });
  });

  done();
};

module.exports = routes;
