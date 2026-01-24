import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonBalance() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function SkeletonBalanceCard() {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}
