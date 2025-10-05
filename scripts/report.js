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

      // return standardized response
      reply.code(201).send({
        success: true,
        message: "Report successfully created.",
        id: result?.id || null,
      });
    } catch (err) {
      // handle backend failure gracefully
      fastify.log.error(err);
      reply.code(500).send({
        success: false,
        error: "Failed to insert new report object.",
      });
    }
  });

  done();
};

module.exports = routes;
