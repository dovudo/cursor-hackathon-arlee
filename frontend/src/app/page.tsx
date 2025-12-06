"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect if we're actually on the home page, not if we're already on onboarding
    if (pathname === "/" && !hasRedirected) {
      setHasRedirected(true);
      router.push("/onboarding");
    }
  }, [router, pathname, hasRedirected]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    </main>
  );
}

