function validateReportPayload(payload) {
  if (!payload) return false;
  if (typeof payload.building_id !== "number") return false;
  if (typeof payload.title !== "string" || payload.title.trim() === "") return false;
  if (typeof payload.description !== "string") return false;
  if (typeof payload.type !== "string" || payload.type.trim() === "") return false;
  return true;
}

// sanitize simple text inputs
function clean(str) {
  if (!str || typeof str !== "string") return "";
  return str.trim().replace(/\s+/g, " ");
}

function now() {
  return new Date().toISOString();
}

// scripts/report.js
//
const routes = (fastify, options, done) => {
  const dbFunctions = require("./database.js");

  // reusable validator for report types
  function isValidType(type) {
    const validTypes = ["vending_machine", "location", "app_functionality", "other"];
    return validTypes.includes(type);
  }

  // route for inserting a report object //
  fastify.post("/report", async (request, reply) => {
    // read data correctly from the body, not params
    let { building_id, title, description, type } = request.body || {};

    // clean inputs
    title = clean(title);
    description = clean(description);

    // Extra building_id validation (must be integer)
    if (isNaN(parseInt(request.body.building_id))) {
      return reply.code(400).send({
        success: false,
        error: "building_id must be an integer."
      });
    }

    if (request.body.title.length > 100) {
      return reply.code(400).send({
        success: false,
        error: "Title exceeds 100 characters."
      });
    }

    if (request.body.description.length > 500) {
      return reply.code(400).send({
        success: false,
        error: "Description exceeds 500 characters."
      });
    }

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
      const timestamp = now();
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

    if (!isValidType(type)) {
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

  fastify.get("/reports/count", async (request, reply) => {
  try {
    const total = await dbFunctions.getReportCount();
    reply.code(200).send({
      success: true,
      total_reports: total
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ success: false, error: "Failed to get report count." });
  }
});

  // simple server health check
  fastify.get("/health", async (request, reply) => {
    reply.code(200).send({
      status: "ok",
      server: "Fastify backend running",
      timestamp: new Date().toISOString()
    });
  });

  // return API version
  fastify.get("/version", async (request, reply) => {
    reply.code(200).send({
      api_version: "1.0.0",
      description: "MunchiMaps backend API"
    });
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

    // GET all reports from last 24 hours
  fastify.get("/reports/recent", async (request, reply) => {
    try {
      const reports = await dbFunctions.getRecentReports();
      reply.code(200).send({
        success: true,
        count: reports.length,
        data: reports
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to retrieve recent reports."
      });
    }
  });

  fastify.patch("/reports/:id/description", async (request, reply) => {
    const { id } = request.params;
    const { description } = request.body;

    if (!description || description.length > 500) {
      return reply.code(400).send({
        success: false,
        error: "Invalid description."
      });
    }

    try {
      await dbFunctions.updateReportDescription(id, description);
      reply.code(200).send({
        success: true,
        message: "Description updated."
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to update description."
      });
    }
  });

  fastify.delete("/reports/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      await dbFunctions.deleteReport(id);
      reply.code(200).send({
        success: true,
        message: "Report deleted."
      });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to delete report."
      });
    }
  });

  fastify.get("/reports/search", async (request, reply) => {
  const { query } = request.query;

  if (!query || query.trim().length < 2) {
    return reply.code(400).send({
      success: false,
      error: "Query must be at least 2 characters."
    });
  }

  try {
    const results = await dbFunctions.searchReports(query);
    reply.code(200).send({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({
      success: false,
      error: "Failed to perform search."
    });
  }
});


module.exports = routes;
