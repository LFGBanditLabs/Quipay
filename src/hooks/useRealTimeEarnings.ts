import { useState, useEffect } from "react";
import { WorkerStream } from "./useStreams";

export interface StreamEarning {
    id: string;
    name: string;
    earned: number;
    flowRate: number;
    symbol: string;
}

export interface EarningsBreakdown {
    totalEarned: number;
    streamEarned: StreamEarning[];
    hourlyRate: number;
    dailyRate: number;
    projectedOneHour: number;
    projectedTwentyFourHours: number;
    activeStreamsCount: number;
}

export const useRealTimeEarnings = (
    streams: WorkerStream[],
    refreshInterval: number = 100,
) => {
    const [earnings, setEarnings] = useState<EarningsBreakdown>({
        totalEarned: 0,
        streamEarned: [],
        hourlyRate: 0,
        dailyRate: 0,
        projectedOneHour: 0,
        projectedTwentyFourHours: 0,
        activeStreamsCount: 0,
    });

    useEffect(() => {
        if (streams.length === 0) {
            setEarnings({
                totalEarned: 0,
                streamEarned: [],
                hourlyRate: 0,
                dailyRate: 0,
                projectedOneHour: 0,
                projectedTwentyFourHours: 0,
                activeStreamsCount: 0,
            });
            return;
        }

        const calculate = () => {
            const now = Date.now() / 1000;
            let total = 0;
            let totalFlowRate = 0;
            const breakdown: StreamEarning[] = [];

            streams.forEach((stream) => {
                const elapsed = Math.max(0, now - stream.startTime);
                const earned = Math.min(elapsed * stream.flowRate, stream.totalAmount);

                total += earned;

                // Only count active streams for projections (those that haven't reached their limit)
                if (earned < stream.totalAmount) {
                    totalFlowRate += stream.flowRate;
                }

                breakdown.push({
                    id: stream.id,
                    name: stream.employerName,
                    earned,
                    flowRate: stream.flowRate,
                    symbol: stream.tokenSymbol,
                });
            });

            const hourlyRate = totalFlowRate * 3600;
            const dailyRate = hourlyRate * 24;

            setEarnings({
                totalEarned: total,
                streamEarned: breakdown,
                hourlyRate,
                dailyRate,
                projectedOneHour: hourlyRate,
                projectedTwentyFourHours: dailyRate,
                activeStreamsCount: streams.filter(s => {
                    const elapsed = Math.max(0, now - s.startTime);
                    return (elapsed * s.flowRate) < s.totalAmount;
                }).length,
            });
        };

        calculate();
        const interval = setInterval(calculate, refreshInterval);

        return () => clearInterval(interval);
    }, [streams, refreshInterval]);

    return earnings;
};
