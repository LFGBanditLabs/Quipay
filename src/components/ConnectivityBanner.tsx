import React, { useState, useEffect } from "react";

const ConnectivityBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] flex items-center justify-center bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg animate-in slide-in-from-top duration-300">
      <span className="mr-2 text-lg">⚠️</span>
      You are currently offline. Using cached data. Some features may be
      unavailable.
    </div>
  );
};

export default ConnectivityBanner;
