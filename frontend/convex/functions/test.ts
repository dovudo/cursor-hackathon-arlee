import { query } from "../_generated/server";

// Тестовый query для проверки подключения Convex
export const testQuery = query({
  args: {},
  handler: async (ctx) => {
    return {
      message: "Convex is working! 🎉",
      timestamp: Date.now(),
      deployment: "connected",
    };
  },
});

