import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@vlc/contracts";
import { HealthResponseSchema } from "@vlc/contracts";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (_request, reply) => {
    const payload: HealthResponse = {
      status: "ok",
      service: "viewport-learning-agent-api",
      contractVersion: "0.1"
    };

    // Validate payload against shared contract schema
    HealthResponseSchema.parse(payload);

    return reply.status(200).send(payload);
  });
};
