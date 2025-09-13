"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserSync() {
  const { user, isSignedIn, isLoaded } = useUser();
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      // Sync user data to Convex database
      createOrUpdateUser({
        clerkId: user.id,
        name: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "User",
        email: user.primaryEmailAddress?.emailAddress || "",
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      }).catch((error) => {
        console.error("Failed to sync user data:", error);
      });
    }
  }, [isLoaded, isSignedIn, user, createOrUpdateUser]);

  return null; // This component doesn't render anything
}
