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

  done();
};

module.exports = routes;
