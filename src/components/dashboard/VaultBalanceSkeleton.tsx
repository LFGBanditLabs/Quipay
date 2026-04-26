import React from "react";
import { Skeleton } from "../Loading/Skeleton";

export const VaultBalanceSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* Token Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
          <div>
            <Skeleton
              variant="rect"
              width="80px"
              height="1rem"
              className="mb-1"
            />
            <Skeleton variant="rect" width="100px" height="0.75rem" />
          </div>
        </div>
        <Skeleton
          variant="rect"
          width="32px"
          height="32px"
          className="rounded-md"
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-[var(--surface)]/50 p-3">
            <Skeleton
              variant="rect"
              width="60px"
              height="0.75rem"
              className="mb-2"
            />
            <Skeleton variant="rect" width="100%" height="1rem" />
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="mb-2 flex justify-between">
          <Skeleton variant="rect" width="70px" height="0.75rem" />
          <Skeleton variant="rect" width="30px" height="0.75rem" />
        </div>
        <Skeleton
          variant="rect"
          width="100%"
          height="0.5rem"
          className="rounded-full"
        />
      </div>
    </div>
  );
};
