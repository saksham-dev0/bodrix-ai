import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Clerk webhook handler for user events
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { type, data: eventData } = body;

      switch (type) {
        case "user.created":
        case "user.updated":
          await ctx.runMutation(internal.users.internalCreateOrUpdateUser, {
            clerkId: eventData.id,
            name: `${eventData.first_name || ""} ${eventData.last_name || ""}`.trim() || eventData.username || "User",
            email: eventData.email_addresses[0]?.email_address || "",
            imageUrl: eventData.image_url,
            firstName: eventData.first_name,
            lastName: eventData.last_name,
          });
          break;

        case "user.deleted":
          await ctx.runMutation(internal.users.internalDeleteUser, {
            clerkId: eventData.id,
          });
          break;

        default:
          console.log(`Unhandled webhook event type: ${type}`);
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook processing failed:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
});

export default http;
