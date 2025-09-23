"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserSync() {
  const { user, isSignedIn, isLoaded } = useUser();
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  useEffect(() => {
    console.log("UserSync - Auth status:", { isLoaded, isSignedIn, user: user?.id });
    if (isLoaded && isSignedIn && user) {
      console.log("UserSync - Syncing user data to Convex:", {
        clerkId: user.id,
        name: user.fullName,
        email: user.primaryEmailAddress?.emailAddress
      });
      
      // Sync user data to Convex database
      createOrUpdateUser({
        clerkId: user.id,
        name: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "User",
        email: user.primaryEmailAddress?.emailAddress || "",
        imageUrl: user.imageUrl,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      }).then(() => {
        console.log("UserSync - User data synced successfully");
      }).catch((error) => {
        console.error("UserSync - Failed to sync user data:", error);
      });
    }
  }, [isLoaded, isSignedIn, user, createOrUpdateUser]);

  return null; // This component doesn't render anything
}
