import React from "react";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen min-w-screen flex flex-col justify-center items-center">
      {children}
    </div>
  );
};

export default Layout;
