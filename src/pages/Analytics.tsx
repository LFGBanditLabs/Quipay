/**
 * Analytics Dashboard
 * ──────────────────────
 * Real-time streaming analytics showing volume, top workers, creation rates, and withdrawal frequency.
 *
 * Features
 * ────────
 * • Total XLM/USDC streamed per day/week
 * • Top workers by earned amount
 * • Stream creation rate metrics
 * • Withdrawal frequency analysis
 * • Real-time data refresh (60 seconds)
 * • Interactive charts using recharts
 * • Responsive design with mobile support
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import {
  Layout,
  Text,
  Select,
  Card,
  Badge,
  Loader,
  Notification,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";

// Types
interface StreamingVolumeData {
  timeframe: string;
  xlm_volume: string;
  usdc_volume: string;
  total_volume: string;
  stream_count: number;
}

interface TopWorkerData {
  worker_address: string;
  total_earned: string;
  stream_count: number;
  last_withdrawal: Date | null;
}

interface StreamCreationData {
  timeframe: string;
  creation_rate: number;
  total_created: number;
  active_streams: number;
  cancelled_streams: number;
}

interface WithdrawalFrequencyData {
  timeframe: string;
  withdrawal_count: number;
  total_withdrawn: string;
  unique_workers: number;
  avg_withdrawal_amount: string;
}

// Styles
const tw = {
  wrapper: "mx-auto max-w-[1400px] p-6",
  header: "mb-8 flex items-start justify-between gap-4",
  title: "mb-2 text-[1.5rem] font-bold text-[var(--sds-color-content-primary,#0f172a)]",
  subtitle: "m-0 text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  controls: "flex items-center gap-4",
  select: "min-w-[120px]",
  grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8",
  card: "rounded-xl border border-[var(--sds-color-neutral-border,#e2e8f0)] bg-[var(--sds-color-background-primary,#fff)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]",
  cardHeader: "mb-4 flex items-center justify-between gap-2",
  cardTitle: "text-lg font-semibold text-[var(--sds-color-content-primary,#0f172a)]",
  cardValue: "text-2xl font-bold text-[var(--sds-color-content-primary,#0f172a)]",
  cardChange: "text-sm mt-1",
  positive: "text-[var(--sds-color-feedback-success)]",
  negative: "text-[var(--sds-color-feedback-error)]",
  chartCard: "lg:col-span-2 xl:col-span-3",
  chartTitle: "mb-4 text-lg font-semibold text-[var(--sds-color-content-primary,#0f172a)]",
  chartContainer: "h-[300px]",
  tableCard: "lg:col-span-2 xl:col-span-4",
  table: "w-full",
  tableHeader: "border-b border-[var(--sds-color-neutral-border,#e2e8f0)] pb-2 mb-2",
  tableRow: "border-b border-[var(--sds-color-neutral-border,#e2e8f0)]",
  tableCell: "py-3 px-2",
  loadingContainer: "flex items-center justify-center py-12",
  walletNotice: "flex items-start gap-2.5 rounded-lg border border-[var(--sds-color-neutral-border,#e2e8f0)] bg-[var(--sds-color-background-secondary,#f8fafc)] px-4 py-3 text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  walletNoticeIcon: "text-base leading-6",
  refreshIndicator: "flex items-center gap-2 text-xs text-[var(--sds-color-content-secondary,#4b5563)]",
  refreshDot: "w-2 h-2 rounded-full bg-[var(--sds-color-feedback-success)]",
  refreshText: "text-[var(--sds-color-content-secondary,#4b5563)]",
};

// Constants
const COLORS = {
  xlm: "#6366f1",
  usdc: "#10b981",
  total: "#8b5cf6",
  creation: "#f59e0b",
  withdrawal: "#ef4444",
  grid: "rgba(156, 163, 175, 0.1)",
};

const formatAmount = (amount: string, decimals: number = 7): string => {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Component
const Analytics: React.FC = () => {
  const { address } = useWallet();
  const { addNotification } = useNotification();
  
  const [timeframe, setTimeframe] = useState<"daily" | "weekly">("daily");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const [streamingVolume, setStreamingVolume] = useState<StreamingVolumeData[]>([]);
  const [topWorkers, setTopWorkers] = useState<TopWorkerData[]>([]);
  const [streamCreation, setStreamCreation] = useState<StreamCreationData[]>([]);
  const [withdrawalFrequency, setWithdrawalFrequency] = useState<WithdrawalFrequencyData[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [volumeRes, workersRes, creationRes, withdrawalRes] = await Promise.all([
        fetch(`/api/analytics/streaming-volume?timeframe=${timeframe}&hours=96`),
        fetch(`/api/analytics/top-workers?limit=10`),
        fetch(`/api/analytics/stream-creation?timeframe=${timeframe}&hours=96`),
        fetch(`/api/analytics/withdrawal-frequency?timeframe=${timeframe}&hours=96`),
      ]);

      const [volumeData, workersData, creationData, withdrawalData] = await Promise.all([
        volumeRes.json(),
        workersRes.json(),
        creationRes.json(),
        withdrawalRes.json(),
      ]);

      if (volumeData.ok) setStreamingVolume(volumeData.data);
      if (workersData.ok) setTopWorkers(workersData.data);
      if (creationData.ok) setStreamCreation(creationData.data);
      if (withdrawalData.ok) setWithdrawalFrequency(withdrawalData.data);
      
      setLastRefresh(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch analytics data";
      setError(message);
      addNotification(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [address, timeframe]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!address) return;
    
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!address) {
    return (
      <div className={tw.loadingContainer}>
        <div className={tw.walletNotice}>
          <span className={tw.walletNoticeIcon}>💼</span>
          <p>Connect your wallet to view analytics dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading && !streamingVolume.length) {
    return (
      <div className={tw.loadingContainer}>
        <Loader size="md" />
        <Text>Loading analytics data...</Text>
      </div>
    );
  }

  // Calculate summary stats
  const totalVolume = streamingVolume.reduce((sum, item) => sum + parseFloat(item.total_volume), 0);
  const totalStreams = streamingVolume.reduce((sum, item) => sum + item.stream_count, 0);
  const avgCreationRate = streamCreation.length > 0 
    ? streamCreation.reduce((sum, item) => sum + item.creation_rate, 0) / streamCreation.length 
    : 0;

  return (
    <Layout.Content>
      <Layout.Inset>
        {/* Header */}
        <div className={tw.header}>
          <div>
            <h1 className={tw.title}>Streaming Analytics</h1>
            <p className={tw.subtitle}>
              Real-time insights into payroll streaming activity and performance metrics
            </p>
          </div>
          
          <div className={tw.controls}>
            <Select
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as "daily" | "weekly")}
              className={tw.select}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
            
            <div className={tw.refreshIndicator}>
              <div className={tw.refreshDot} />
              <span className={tw.refreshText}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Notification
            variant="error"
            onClose={() => setError(null)}
            title="Analytics Error"
          >
            {error}
          </Notification>
        )}

        {/* Summary Cards */}
        <div className={tw.grid}>
          <Card className={tw.card}>
            <div className={tw.cardHeader}>
              <Text size="sm" variant="secondary">
                Total Volume (96h)
              </Text>
            </div>
            <div className={tw.cardValue}>
              {formatAmount(totalVolume.toString())} XLM
            </div>
          </Card>
          
          <Card className={tw.card}>
            <div className={tw.cardHeader}>
              <Text size="sm" variant="secondary">
                Active Streams
              </Text>
            </div>
            <div className={tw.cardValue}>{totalStreams}</div>
          </Card>
          
          <Card className={tw.card}>
            <div className={tw.cardHeader}>
              <Text size="sm" variant="secondary">
                Avg Creation Rate
              </Text>
            </div>
            <div className={tw.cardValue}>
              {avgCreationRate.toFixed(1)}/day
            </div>
          </Card>
          
          <Card className={tw.card}>
            <div className={tw.cardHeader}>
              <Text size="sm" variant="secondary">
                Top Worker Earnings
              </Text>
            </div>
            <div className={tw.cardValue}>
              {topWorkers.length > 0 ? formatAmount(topWorkers[0].total_earned) : "0"} XLM
            </div>
          </Card>
        </div>

        {/* Streaming Volume Chart */}
        <Card className={`${tw.card} ${tw.chartCard}`}>
          <h3 className={tw.chartTitle}>
            Streaming Volume ({timeframe === "daily" ? "Daily" : "Weekly"})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={streamingVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis 
                dataKey="timeframe" 
                tickFormatter={formatDate}
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <YAxis 
                tickFormatter={(value) => formatAmount(value.toString())}
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <Tooltip 
                formatter={(value: any, name: any) => [
                  formatAmount(value.toString()),
                  name,
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="xlm_volume"
                stackId="1"
                stroke={COLORS.xlm}
                fill={COLORS.xlm}
                fillOpacity={0.6}
                name="XLM Volume"
              />
              <Area
                type="monotone"
                dataKey="usdc_volume"
                stackId="2"
                stroke={COLORS.usdc}
                fill={COLORS.usdc}
                fillOpacity={0.6}
                name="USDC Volume"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Stream Creation Rate */}
        <Card className={`${tw.card} ${tw.chartCard}`}>
          <h3 className={tw.chartTitle}>
            Stream Creation Rate ({timeframe === "daily" ? "Daily" : "Weekly"})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={streamCreation}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis 
                dataKey="timeframe" 
                tickFormatter={formatDate}
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <YAxis 
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <Tooltip 
                formatter={(value: any, name: any) => [value, name]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="creation_rate"
                stroke={COLORS.creation}
                strokeWidth={2}
                dot={{ fill: COLORS.creation, strokeWidth: 2, r: 4 }}
                name="Creation Rate"
              />
              <Line
                type="monotone"
                dataKey="active_streams"
                stroke={COLORS.total}
                strokeWidth={2}
                dot={{ fill: COLORS.total, strokeWidth: 2, r: 4 }}
                name="Active Streams"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Withdrawal Frequency */}
        <Card className={`${tw.card} ${tw.chartCard}`}>
          <h3 className={tw.chartTitle}>
            Withdrawal Frequency ({timeframe === "daily" ? "Daily" : "Weekly"})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={withdrawalFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis 
                dataKey="timeframe" 
                tickFormatter={formatDate}
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <YAxis 
                stroke="rgba(156, 163, 175, 0.5)"
              />
              <Tooltip 
                formatter={(value: any, name: any) => [value, name]}
              />
              <Legend />
              <Bar
                dataKey="withdrawal_count"
                fill={COLORS.withdrawal}
                name="Withdrawal Count"
              />
              <Bar
                dataKey="unique_workers"
                fill={COLORS.total}
                name="Unique Workers"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Workers Table */}
        <Card className={`${tw.card} ${tw.tableCard}`}>
          <h3 className={tw.chartTitle}>Top Workers by Earnings</h3>
          <div className={tw.table}>
            <div className={tw.tableHeader}>
              <div className="grid grid-cols-4 gap-4 font-semibold">
                <div>Worker Address</div>
                <div>Total Earned</div>
                <div>Stream Count</div>
                <div>Last Withdrawal</div>
              </div>
            </div>
            
            {topWorkers.map((worker, index) => (
              <div key={worker.worker_address} className={tw.tableRow}>
                <div className="grid grid-cols-4 gap-4">
                  <div className={tw.tableCell}>
                    <Badge size="sm" variant="default">
                      #{index + 1}
                    </Badge>
                    <span className="ml-2">{formatAddress(worker.worker_address)}</span>
                  </div>
                  <div className={tw.tableCell}>
                    {formatAmount(worker.total_earned)} XLM
                  </div>
                  <div className={tw.tableCell}>{worker.stream_count}</div>
                  <div className={tw.tableCell}>
                    {worker.last_withdrawal 
                      ? new Date(worker.last_withdrawal).toLocaleDateString()
                      : "Never"
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Analytics;
