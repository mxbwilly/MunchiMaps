// scripts/report.js
//
const routes = (fastify, options, done) => {
  const dbFunctions = require("./database.js");

  // route for inserting a report object //
  fastify.post("/report", async (request, reply) => {
    // read data correctly from the body, not params
    const { building_id, title, description, type } = request.body || {};

    // validate input before DB call
    if (!title || !type || !description) {
      return reply.code(400).send({
        success: false,
        error: "Missing required fields: title, type, or description.",
      });
    }

    const validTypes = ["vending_machine", "location", "app_functionality", "other"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    try {
      const result = await dbFunctions.addReport(building_id, title, description, type);

      // Log the report to console with timestamp
      const timestamp = new Date().toISOString();
      fastify.log.info(`[REPORT CREATED] ${timestamp} | ${title} | ${description}`);

      // standardized response
      reply.code(201).send({
        success: true,
        message: "Report successfully created and logged.",
        id: result?.id || null,
        timestamp: timestamp
      });
    } catch (err) {
      // Add more detailed logging
      fastify.log.error("Failed to insert report:", err);

      reply.code(500).send({
        success: false,
        error: "Failed to insert new report object.",
        details: err.message
      });
    }

  });

  // route for retrieving all reports
  fastify.get("/reports", async (request, reply) => {
    try {
      const reports = await dbFunctions.getAllReports();
      reply.code(200).send({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to retrieve reports from the database.",
      });
    }
  });

  // route for retrieving reports for a specific building
  fastify.get("/reports/building/:building_id", async (request, reply) => {
    const { building_id } = request.params;

    try {
      const reports = await dbFunctions.getReportsByBuilding(building_id);

      reply.code(200).send({
        success: true,
        building_id: building_id,
        count: reports.length,
        data: reports
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to retrieve reports for this building."
      });
    }
  });

  // route for retrieving reports filtered by type
  fastify.get("/reports/type/:type", async (request, reply) => {
    const { type } = request.params;

    const validTypes = ["vending_machine", "location", "app_functionality", "other"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({
        success: false,
        error: `Invalid report type. Valid types: ${validTypes.join(", ")}`
      });
    }

    try {
      const reports = await dbFunctions.getReportsByType(type);

      reply.code(200).send({
        success: true,
        count: reports.length,
        type: type,
        data: reports
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to retrieve filtered reports from the database."
      });
    }
  });

  done();
};

  // route for retrieving report statistics
  fastify.get("/reports/stats", async (request, reply) => {
    try {
      const stats = await dbFunctions.getReportStats();
      reply.code(200).send({
        success: true,
        total_reports: stats.total,
        by_type: stats.byType
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to retrieve report statistics."
      });
    }
  });

module.exports = routes;
