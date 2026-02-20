import React from "react";
import { Layout, Text, Button, Loader } from "@stellar/design-system";
import { usePayroll } from "../hooks/usePayroll";
import styles from "./EmployerDashboard.module.css";
import { useNavigate } from "react-router-dom";

const EmployerDashboard: React.FC = () => {
    const {
        treasuryBalances,
        totalLiabilities,
        activeStreamsCount,
        activeStreams,
        isLoading,
    } = usePayroll();
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <Layout.Content>
                <Layout.Inset>
                    <div style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                        <Loader />
                    </div>
                </Layout.Inset>
            </Layout.Content>
        );
    }

    return (
        <Layout.Content>
            <Layout.Inset>
                <Text as="h1" size="xl" weight="medium">
                    Employer Dashboard
                </Text>

                <div className={styles.dashboardGrid}>
                    {/* Treasury Balance */}
                    <div className={styles.card} id="tour-treasury-balance">
                        <Text as="span" size="md" weight="semi-bold" className={styles.cardHeader}>
                            Treasury Balance
                        </Text>
                        {treasuryBalances.map((balance) => (
                            <div key={balance.tokenSymbol}>
                                <Text as="div" size="lg" className={styles.metricValue}>
                                    {balance.balance} {balance.tokenSymbol}
                                </Text>
                            </div>
                        ))}
                        <div style={{ marginTop: "10px" }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                id="tour-manage-treasury"
                                onClick={() => navigate("/treasury-management")}
                            >
                                Manage Treasury
                            </Button>
                        </div>
                    </div>

                    {/* Total Liabilities */}
                    <div className={styles.card} id="tour-liabilities">
                        <Text as="span" size="md" weight="semi-bold" className={styles.cardHeader}>
                            Total Liabilities
                        </Text>
                        <Text as="div" size="lg" className={styles.metricValue}>
                            {totalLiabilities}
                        </Text>
                        <Text as="p" size="sm">
                            Estimated monthly
                        </Text>
                    </div>

                    {/* Active Streams Count */}
                    <div className={styles.card} id="tour-active-streams">
                        <Text as="span" size="md" weight="semi-bold" className={styles.cardHeader}>
                            Active Streams
                        </Text>
                        <Text as="div" size="lg" className={styles.metricValue}>
                            {activeStreamsCount}
                        </Text>
                    </div>
                </div>

                <div className={styles.streamsSection}>
                    <div className={styles.streamsHeader}>
                        <Text as="h2" size="lg">
                            Active Streams
                        </Text>
                        <Button
                            variant="primary"
                            size="md"
                            id="tour-create-stream"
                            onClick={() => navigate("/create-stream")}
                        >
                            Create New Stream
                        </Button>
                    </div>

                    {activeStreams.length === 0 ? (
                        <Text as="p" size="md">No active streams found.</Text>
                    ) : (
                        <div className={styles.streamsList} id="tour-streams-list">
                            {activeStreams.map((stream) => (
                                <div key={stream.id} className={styles.streamItem}>
                                    <div>
                                        <Text as="div" size="md" weight="bold">{stream.employeeName}</Text>
                                        <Text as="div" size="sm">{stream.employeeAddress}</Text>
                                    </div>
                                    <div>
                                        <Text as="div" size="md">Flow Rate: {stream.flowRate} {stream.tokenSymbol}/sec</Text>
                                        <Text as="div" size="sm">Start: {stream.startDate}</Text>
                                    </div>
                                    <div>
                                        <Text as="div" size="md" weight="bold">Total: {stream.totalStreamed} {stream.tokenSymbol}</Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Layout.Inset>
        </Layout.Content>
    );
};

export default EmployerDashboard;
