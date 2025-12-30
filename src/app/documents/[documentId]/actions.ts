"use server"

import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
export async function getDocuments(ids: Id<"documents">[]) {
  return await convex.query(api.documents.getByIds, { ids });
};

export async function getUsers() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return [];
  }

  const clerk = await clerkClient();
  const orgId = (sessionClaims as { o?: { id?: string } } | null)?.o?.id;

  if (!orgId) {
    const user = await clerk.users.getUser(userId);
    return [
      {
        id: user.id,
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous",
        avatar: user.imageUrl,
        color: "",
      },
    ];
  }

  const response = await clerk.users.getUserList({
    organizationId: [orgId],
  });

  const users = response.data.map((user) => ({
    id: user.id,
    name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous",
    avatar: user.imageUrl,
    color: "",
  }));
  return users;
}
