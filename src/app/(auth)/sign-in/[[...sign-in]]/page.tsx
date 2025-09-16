import { SignIn } from "@clerk/nextjs";
import React from "react";

const Page = () => {
  return <SignIn routing="hash" />;
};

export default Page;
