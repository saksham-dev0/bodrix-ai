"use client";

import { Button } from "@/components/ui/button";
import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserSync } from "@/components/UserSync";

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);

  if (!isLoaded) {
    return (
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <UserSync />
      <div className="flex flex-col items-center gap-4">
        {isSignedIn ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome, {user?.firstName || user?.username}!</h1>
            {currentUser && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <h2 className="font-semibold mb-2">User Information from Database:</h2>
                <p><strong>Name:</strong> {currentUser.name}</p>
                <p><strong>Email:</strong> {currentUser.email}</p>
                {currentUser.firstName && <p><strong>First Name:</strong> {currentUser.firstName}</p>}
                {currentUser.lastName && <p><strong>Last Name:</strong> {currentUser.lastName}</p>}
                <p><strong>Created:</strong> {new Date(currentUser.createdAt).toLocaleDateString()}</p>
              </div>
            )}
            <SignOutButton>
              <Button variant="outline">Sign Out</Button>
            </SignOutButton>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to Bodrix!</h1>
            <p className="mb-4">Please sign in to continue.</p>
            <SignInButton>
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        )}
      </div>
    </div>
  );
}
