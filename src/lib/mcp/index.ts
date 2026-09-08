import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPosts from "./tools/list-posts";
import createPost from "./tools/create-post";
import listDiscussions from "./tools/list-discussions";
import listEvents from "./tools/list-events";
import getProfile from "./tools/get-profile";
import sendMessage from "./tools/send-message";
import listStartups from "./tools/list-startups";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "founderhunt-mcp",
  title: "FounderHunt Community",
  version: "0.1.0",
  instructions:
    "Tools for the FounderHunt founders community: browse and create feed posts, list discussions, events, and startups, read your profile, and send direct messages. All actions run as the connected user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listPosts,
    createPost,
    listDiscussions,
    listEvents,
    getProfile,
    sendMessage,
    listStartups,
  ],
});
