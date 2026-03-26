import React from "react";
import { Skeleton } from "../Loading/Skeleton";

export const StreamCardSkeleton: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <Skeleton variant="rect" width="60%" height="1.5rem" className="mb-2" />
          <Skeleton variant="rect" width="80%" height="0.75rem" />
        </div>
        <Skeleton variant="rect" width="100px" height="1.5rem" className="rounded-md" />
      </div>

      {/* Cliff Status Indicator Mock */}
      <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton variant="circle" width="1.25rem" height="1.25rem" />
          <Skeleton variant="rect" width="140px" height="1rem" />
        </div>
        <Skeleton variant="rect" width="60%" height="0.75rem" className="mb-2" />
        <Skeleton variant="rect" width="90%" height="0.75rem" />
      </div>

      <div className="my-6">
        <Skeleton variant="rect" width="120px" height="0.75rem" className="mb-3" />
        <Skeleton variant="rect" width="180px" height="2rem" className="mb-2" />
        <Skeleton variant="rect" width="100px" height="1rem" />
      </div>

      <div className="my-4 h-2 overflow-hidden rounded bg-[var(--surface)]">
        <Skeleton variant="rect" width="100%" height="100%" />
      </div>

      <div className="mb-4 flex justify-between">
        <Skeleton variant="rect" width="60px" height="0.75rem" />
        <Skeleton variant="rect" width="80px" height="0.75rem" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton variant="rect" width="100%" height="3rem" className="rounded-xl" />
        <Skeleton variant="rect" width="100%" height="3rem" className="rounded-xl" />
      </div>
    </div>
  );
};
