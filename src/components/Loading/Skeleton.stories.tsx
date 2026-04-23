import {
  ChartPanelSkeleton,
  StatTileSkeleton,
  StreamCardSkeleton,
  TransactionRowSkeleton,
} from "./Skeleton";

export default {
  title: "Loading/Skeletons",
};

export const StreamCard = () => <StreamCardSkeleton />;

export const StatTile = () => <StatTileSkeleton />;

export const ChartPanel = () => <ChartPanelSkeleton />;

export const TransactionRow = () => <TransactionRowSkeleton />;
