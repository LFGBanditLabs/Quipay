import React from "react";
import { Skeleton } from "../Loading/Skeleton";

export const EarningsSkeleton: React.FC = () => {
  return (
    <div className="relative mb-8 flex flex-col gap-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] dark:bg-[rgba(var(--surface-rgb),0.03)] dark:backdrop-blur-[20px]">
      <div className="z-[1] flex items-center justify-between max-[992px]:flex-col max-[992px]:items-start max-[992px]:gap-8">
        <div className="flex flex-1 flex-col">
          <Skeleton
            variant="rect"
            width="180px"
            height="0.75rem"
            className="mb-3"
          />
          <div className="flex items-baseline gap-2">
            <Skeleton
              variant="rect"
              width="240px"
              height="3.5rem"
              className="max-[992px]:h-[2.5rem]"
            />
            <Skeleton variant="rect" width="60px" height="1.5rem" />
          </div>
          <Skeleton
            variant="rect"
            width="140px"
            height="1.75rem"
            className="mt-4 rounded-[20px]"
          />
        </div>

        <div className="flex min-h-[200px] flex-1 justify-end max-[992px]:w-full max-[992px]:justify-center">
          <Skeleton variant="circle" width="180px" height="180px" />
        </div>
      </div>

      <div className="z-[1] grid grid-cols-3 gap-6 max-[768px]:grid-cols-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] dark:bg-[rgba(var(--surface-rgb),0.03)]"
          >
            <Skeleton
              variant="rect"
              width="120px"
              height="0.75rem"
              className="mb-3"
            />
            <Skeleton variant="rect" width="100%" height="1.5rem" />
          </div>
        ))}
      </div>
    </div>
  );
};
