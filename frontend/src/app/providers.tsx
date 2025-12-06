"use client";

import { ConvexProviderWrapper } from "@/convex-provider";
import { ProjectProvider } from "@/context/ProjectContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ConvexProviderWrapper>
        <ProjectProvider>{children}</ProjectProvider>
      </ConvexProviderWrapper>
    </ErrorBoundary>
  );
}


