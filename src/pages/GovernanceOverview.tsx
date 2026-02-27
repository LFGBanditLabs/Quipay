/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — @stellar/design-system types are incomplete for Badge, Card, Modal, Icon
import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Layout,
  Text,
  Loader,
  Card,
  Badge,
  Icon,
  Modal,
  Notification,
} from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

const tw = {
  loadingContainer: "flex flex-col items-center justify-center gap-4 p-[60px]",
  loadingText: "text-[var(--color-text-secondary)]",
  header: "mb-6 flex items-start justify-between gap-4",
  statusCard:
    "mb-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-card)] p-6",
  statusGrid: "grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6",
  statusItem: "flex flex-col gap-1",
  badgeRow: "flex items-center gap-2",
  section: "mb-8",
  sectionTitle: "mb-4 flex items-center gap-2",
  emptyState:
    "flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-card)] p-10 text-center",
  emptyIcon: "text-[var(--sds-color-feedback-success)] opacity-60",
  proposalsList: "flex flex-col gap-4",
  proposalCard:
    "rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-card)] p-5 transition-shadow hover:shadow-[0_4px_12px_var(--shadow-color)]",
  proposalHeader: "mb-3 flex items-center justify-between",
  proposalType: "flex items-center gap-2",
  proposalTitle: "mb-2 leading-[1.4]",
  proposalDescription: "mb-4 leading-[1.5]",
  amountRow: "mb-2 flex items-center gap-2",
  targetRow: "mb-2 flex items-center gap-2",
  address:
    "rounded-md bg-[var(--accent-transparent)] px-2 py-1 font-[DM_Mono,monospace] text-[0.85em]",
  signersSection: "my-4 rounded-xl bg-[var(--surface-subtle)] p-4",
  signersHeader: "mb-3 flex items-center justify-between",
  signersList: "mb-3 flex flex-col gap-2",
  signerItem:
    "flex items-center gap-2 rounded-lg bg-[var(--surface-subtle)] px-3 py-2 transition-colors",
  signed: "bg-[var(--success-transparent)]",
  currentUser: "border border-[var(--success-transparent-strong)]",
  signerStatus: "flex h-5 w-5 items-center justify-center",
  checkIcon: "text-[var(--sds-color-feedback-success)]",
  pendingDot:
    "h-2 w-2 rounded-full bg-[var(--sds-color-feedback-warning)] [animation:pulse_1.5s_ease-in-out_infinite]",
  youBadge: "font-semibold text-[var(--sds-color-feedback-success)]",
  signedTime: "ml-auto text-xs",
  progressBar: "h-1 overflow-hidden rounded bg-[var(--border)]",
  progressFill: "h-full rounded transition-all",
  actionButtons: "mt-4 flex gap-3",
  executedIcon: "text-[var(--sds-color-feedback-success)]",
  unsigned: "bg-[var(--surface-subtle)]",
  historyList: "flex flex-col gap-3",
  historyCard:
    "rounded-xl border border-[var(--color-border)] bg-[var(--color-background-card)] p-4",
  historyHeader: "mb-2 flex items-center justify-between",
  historyType: "font-medium",
  historyStatus: "text-sm text-[var(--muted)]",
  historyMeta: "text-xs text-[var(--muted)]",
  modalContent:
    "rounded-2xl border border-white/20 bg-slate-900/90 p-6 text-slate-100 shadow-2xl backdrop-blur",
  modalSection: "mb-4",
  modalGrid: "grid grid-cols-2 gap-3",
  modalItem: "rounded-lg bg-white/5 p-3",
  modalSignersList: "flex flex-col gap-2",
  modalSigner: "flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2",
  modalSigned: "text-emerald-300",
  modalPendingDot:
    "h-2 w-2 rounded-full bg-amber-300 [animation:pulse_1.5s_ease-in-out_infinite]",
  modalApprovals: "text-sm text-slate-300",
  modalActions: "mt-5 flex justify-end gap-3",
};

// Types for multisig governance
export interface MultisigProposal {
  id: string;
  title: string;
  description: string;
  type: "transfer" | "upgrade" | "admin_change" | "threshold_change" | "custom";
  proposer: string;
  createdAt: Date;
  expiresAt: Date;
  requiredApprovals: number;
  currentApprovals: number;
  hasApproved: boolean;
  isExecuted: boolean;
  executedAt?: Date;
  executedBy?: string;
  signers: SignerStatus[];
  targetAddress?: string;
  amount?: string;
  tokenSymbol?: string;
}

export interface SignerStatus {
  address: string;
  hasSigned: boolean;
  signedAt?: Date;
  isCurrentUser: boolean;
}

export interface ExecutionHistoryEntry {
  id: string;
  proposalId: string;
  title: string;
  type: MultisigProposal["type"];
  executedAt: Date;
  executedBy: string;
  requiredApprovals: number;
  totalSigners: number;
}

export interface MultisigConfig {
  threshold: number;
  totalSigners: number;
  signers: string[];
  isCurrentUserSigner: boolean;
}

// Mock service for multisig operations
const mockMultisigService = {
  getMultisigConfig: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _vaultAddress: string,
  ): Promise<MultisigConfig> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      threshold: 2,
      totalSigners: 3,
      signers: ["GCFX...ABC1", "GDYQ...DEF2", "GAHU...GHI3"],
      isCurrentUserSigner: true,
    };
  },

  getPendingProposals: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _vaultAddress: string,
  ): Promise<MultisigProposal[]> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return [
      {
        id: "prop-001",
        title: "Withdraw 10,000 USDC to Operations Wallet",
        description: "Monthly operational expense withdrawal for team salaries",
        type: "transfer",
        proposer: "GCFX...ABC1",
        createdAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 172800000),
        requiredApprovals: 2,
        currentApprovals: 1,
        hasApproved: false,
        isExecuted: false,
        targetAddress: "GAHU...XYZ9",
        amount: "10000",
        tokenSymbol: "USDC",
        signers: [
          {
            address: "GCFX...ABC1",
            hasSigned: true,
            signedAt: new Date(Date.now() - 43200000),
            isCurrentUser: false,
          },
          { address: "GDYQ...DEF2", hasSigned: false, isCurrentUser: true },
          { address: "GAHU...GHI3", hasSigned: false, isCurrentUser: false },
        ],
      },
      {
        id: "prop-002",
        title: "Upgrade Treasury Contract to v2.1",
        description: "Security patch update for the treasury vault contract",
        type: "upgrade",
        proposer: "GDYQ...DEF2",
        createdAt: new Date(Date.now() - 172800000),
        expiresAt: new Date(Date.now() + 86400000),
        requiredApprovals: 2,
        currentApprovals: 1,
        hasApproved: true,
        isExecuted: false,
        signers: [
          { address: "GCFX...ABC1", hasSigned: false, isCurrentUser: false },
          {
            address: "GDYQ...DEF2",
            hasSigned: true,
            signedAt: new Date(Date.now() - 86400000),
            isCurrentUser: true,
          },
          { address: "GAHU...GHI3", hasSigned: false, isCurrentUser: false },
        ],
      },
      {
        id: "prop-003",
        title: "Add New Signer: GCXZ...NEW4",
        description:
          "Add additional signer for improved security and availability",
        type: "admin_change",
        proposer: "GAHU...GHI3",
        createdAt: new Date(Date.now() - 43200000),
        expiresAt: new Date(Date.now() + 259200000),
        requiredApprovals: 2,
        currentApprovals: 0,
        hasApproved: false,
        isExecuted: false,
        signers: [
          { address: "GCFX...ABC1", hasSigned: false, isCurrentUser: false },
          { address: "GDYQ...DEF2", hasSigned: false, isCurrentUser: true },
          { address: "GAHU...GHI3", hasSigned: false, isCurrentUser: false },
        ],
      },
    ];
  },

  getExecutionHistory: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _vaultAddress: string,
  ): Promise<ExecutionHistoryEntry[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return [
      {
        id: "exec-001",
        proposalId: "prop-000",
        title: "Withdraw 5,000 XLM for Marketing",
        type: "transfer",
        executedAt: new Date(Date.now() - 604800000),
        executedBy: "GDYQ...DEF2",
        requiredApprovals: 2,
        totalSigners: 3,
      },
      {
        id: "exec-002",
        proposalId: "prop-099",
        title: "Change Threshold to 2-of-3",
        type: "threshold_change",
        executedAt: new Date(Date.now() - 1209600000),
        executedBy: "GCFX...ABC1",
        requiredApprovals: 2,
        totalSigners: 2,
      },
      {
        id: "exec-003",
        proposalId: "prop-098",
        title: "Add Initial Signers",
        type: "admin_change",
        executedAt: new Date(Date.now() - 2592000000),
        executedBy: "GCFX...ABC1",
        requiredApprovals: 1,
        totalSigners: 1,
      },
    ];
  },

  approveProposal: async (proposalId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log(`Approved proposal ${proposalId}`);
  },

  executeProposal: async (proposalId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`Executed proposal ${proposalId}`);
  },
};

const shortenAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTypeIcon = (type: MultisigProposal["type"]): string => {
  switch (type) {
    case "transfer":
      return "send";
    case "upgrade":
      return "arrowUp";
    case "admin_change":
      return "user";
    case "threshold_change":
      return "settings";
    default:
      return "fileText";
  }
};

const getTypeColor = (type: MultisigProposal["type"]): string => {
  switch (type) {
    case "transfer":
      return "var(--sds-color-feedback-success)";
    case "upgrade":
      return "var(--sds-color-feedback-warning)";
    case "admin_change":
      return "var(--accent)";
    case "threshold_change":
      return "#8b5cf6"; // Keep special color but check contrast
    default:
      return "var(--muted)";
  }
};

const GovernanceOverview: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<MultisigConfig | null>(null);
  const [proposals, setProposals] = useState<MultisigProposal[]>([]);
  const [history, setHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [selectedProposal, setSelectedProposal] =
    useState<MultisigProposal | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const vaultAddress = address ?? "demo-vault";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configData, proposalsData, historyData] = await Promise.all([
        mockMultisigService.getMultisigConfig(vaultAddress),
        mockMultisigService.getPendingProposals(vaultAddress),
        mockMultisigService.getExecutionHistory(vaultAddress),
      ]);
      setConfig(configData);
      setProposals(proposalsData);
      setHistory(historyData);
    } catch (error) {
      console.error("Failed to load governance data:", error);
      setNotification({
        message: "Failed to load governance data",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [vaultAddress]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async (proposalId: string) => {
    setIsProcessing(true);
    try {
      await mockMultisigService.approveProposal(proposalId);
      setNotification({
        message: "Proposal approved successfully",
        type: "success",
      });
      await loadData();
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _error
    ) {
      setNotification({ message: "Failed to approve proposal", type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async (proposalId: string) => {
    setIsProcessing(true);
    try {
      await mockMultisigService.executeProposal(proposalId);
      setNotification({
        message: "Proposal executed successfully",
        type: "success",
      });
      await loadData();
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _error
    ) {
      setNotification({ message: "Failed to execute proposal", type: "error" });
    } finally {
      setIsProcessing(false);
      setIsModalOpen(false);
    }
  };

  const openProposalDetails = (proposal: MultisigProposal) => {
    setSelectedProposal(proposal);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProposal(null);
  };

  const canExecute = (proposal: MultisigProposal): boolean => {
    return (
      proposal.currentApprovals >= proposal.requiredApprovals &&
      !proposal.isExecuted
    );
  };

  const pendingCount = proposals.filter((p) => !p.isExecuted).length;
  const readyToExecuteCount = proposals.filter((p) => canExecute(p)).length;

  if (isLoading) {
    return (
      <Layout.Content>
        <Layout.Inset>
          <div className={tw.loadingContainer}>
            <Loader />
            <Text as="p" size="md" className={tw.loadingText}>
              Loading governance data...
            </Text>
          </div>
        </Layout.Inset>
      </Layout.Content>
    );
  }

  return (
    <Layout.Content>
      <Layout.Inset>
        {/* Header */}
        <div className={tw.header}>
          <div>
            <Text as="h1" size="xl" weight="medium">
              Governance Overview
            </Text>
            <Text as="p" size="md" variant="secondary">
              Multisig Treasury Management
            </Text>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void navigate("/treasury-management")}
          >
            <Icon.ArrowLeft size="sm" /> Back to Treasury
          </Button>
        </div>

        {/* Notification */}
        {notification && (
          <Notification
            variant={notification.type}
            onClose={() => setNotification(null)}
            title={notification.type === "success" ? "Success" : "Error"}
          >
            {notification.message}
          </Notification>
        )}

        {/* Multisig Status Card */}
        {config && (
          <Card className={tw.statusCard}>
            <div className={tw.statusGrid}>
              <div className={tw.statusItem}>
                <Text as="span" size="sm" variant="secondary">
                  Required Approvals
                </Text>
                <Text as="div" size="lg" weight="bold">
                  {config.threshold} of {config.totalSigners}
                </Text>
              </div>
              <div className={tw.statusItem}>
                <Text as="span" size="sm" variant="secondary">
                  Total Signers
                </Text>
                <Text as="div" size="lg" weight="bold">
                  {config.totalSigners}
                </Text>
              </div>
              <div className={tw.statusItem}>
                <Text as="span" size="sm" variant="secondary">
                  Pending Proposals
                </Text>
                <div className={tw.badgeRow}>
                  <Text as="div" size="lg" weight="bold">
                    {pendingCount}
                  </Text>
                  {readyToExecuteCount > 0 && (
                    <Badge variant="success" size="sm">
                      {readyToExecuteCount} ready
                    </Badge>
                  )}
                </div>
              </div>
              <div className={tw.statusItem}>
                <Text as="span" size="sm" variant="secondary">
                  Your Role
                </Text>
                <Badge
                  variant={config.isCurrentUserSigner ? "success" : "warning"}
                  size="sm"
                >
                  {config.isCurrentUserSigner ? "Signer" : "Viewer"}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Pending Proposals Section */}
        <div className={tw.section}>
          <Text as="h2" size="lg" weight="medium" className={tw.sectionTitle}>
            Pending Proposals
          </Text>

          {proposals.length === 0 ? (
            <Card className={tw.emptyState}>
              <Icon.CheckCircle size="lg" className={tw.emptyIcon} />
              <Text as="p" size="md">
                No pending proposals
              </Text>
              <Text as="p" size="sm" variant="secondary">
                All proposals have been executed or expired
              </Text>
            </Card>
          ) : (
            <div className={tw.proposalsList}>
              {proposals.map((proposal) => (
                <Card key={proposal.id} className={tw.proposalCard}>
                  <div className={tw.proposalHeader}>
                    <div className={tw.proposalType}>
                      <Icon name={getTypeIcon(proposal.type)} size="md" />
                      <Badge
                        size="sm"
                        style={{
                          backgroundColor: `${getTypeColor(proposal.type)}20`,
                          color: getTypeColor(proposal.type),
                          borderColor: getTypeColor(proposal.type),
                        }}
                      >
                        {proposal.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <Text as="span" size="sm" variant="secondary">
                      {formatDate(proposal.createdAt)}
                    </Text>
                  </div>

                  <Text
                    as="h3"
                    size="md"
                    weight="semi-bold"
                    className={tw.proposalTitle}
                  >
                    {proposal.title}
                  </Text>

                  <Text
                    as="p"
                    size="sm"
                    variant="secondary"
                    className={tw.proposalDescription}
                  >
                    {proposal.description}
                  </Text>

                  {proposal.amount && proposal.tokenSymbol && (
                    <div className={tw.amountRow}>
                      <Text as="span" size="sm" variant="secondary">
                        Amount:
                      </Text>
                      <Text
                        as="span"
                        size="md"
                        weight="semi-bold"
                        style={{ color: "var(--sds-color-feedback-success)" }}
                      >
                        {proposal.amount} {proposal.tokenSymbol}
                      </Text>
                    </div>
                  )}

                  {proposal.targetAddress && (
                    <div className={tw.targetRow}>
                      <Text as="span" size="sm" variant="secondary">
                        To:
                      </Text>
                      <Text as="span" size="sm" className={tw.address}>
                        {shortenAddress(proposal.targetAddress)}
                      </Text>
                    </div>
                  )}

                  {/* Signers Progress */}
                  <div className={tw.signersSection}>
                    <div className={tw.signersHeader}>
                      <Text as="span" size="sm" variant="secondary">
                        Signers
                      </Text>
                      <Text as="span" size="sm" weight="semi-bold">
                        {proposal.currentApprovals} /{" "}
                        {proposal.requiredApprovals}
                      </Text>
                    </div>
                    <div className={tw.signersList}>
                      {proposal.signers.map((signer) => (
                        <div
                          key={signer.address}
                          className={`${tw.signerItem} ${
                            signer.hasSigned ? tw.signed : tw.unsigned
                          } ${signer.isCurrentUser ? tw.currentUser : ""}`}
                        >
                          <div className={tw.signerStatus}>
                            {signer.hasSigned ? (
                              <Icon.Check size="sm" className={tw.checkIcon} />
                            ) : (
                              <div className={tw.pendingDot} />
                            )}
                          </div>
                          <Text as="span" size="sm">
                            {shortenAddress(signer.address)}
                            {signer.isCurrentUser && (
                              <span className={tw.youBadge}> (You)</span>
                            )}
                          </Text>
                          {signer.hasSigned && signer.signedAt && (
                            <Text
                              as="span"
                              size="xs"
                              variant="secondary"
                              className={tw.signedTime}
                            >
                              {formatDate(signer.signedAt)}
                            </Text>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={tw.progressBar}>
                      <div
                        className={tw.progressFill}
                        style={{
                          width: `${(proposal.currentApprovals / proposal.requiredApprovals) * 100}%`,
                          backgroundColor:
                            proposal.currentApprovals >=
                            proposal.requiredApprovals
                              ? "var(--sds-color-feedback-success)"
                              : "var(--sds-color-feedback-warning)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={tw.actionButtons}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openProposalDetails(proposal)}
                    >
                      View Details
                    </Button>

                    {config?.isCurrentUserSigner &&
                      !proposal.hasApproved &&
                      !proposal.isExecuted && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void handleApprove(proposal.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader size="sm" />
                          ) : (
                            <Icon.Check size="sm" />
                          )}
                          Approve
                        </Button>
                      )}

                    {config?.isCurrentUserSigner &&
                      proposal.hasApproved &&
                      !proposal.isExecuted && (
                        <Button variant="secondary" size="sm" disabled>
                          <Icon.Check size="sm" /> Approved
                        </Button>
                      )}

                    {canExecute(proposal) && config?.isCurrentUserSigner && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openProposalDetails(proposal)}
                        style={{
                          backgroundColor: "var(--sds-color-feedback-success)",
                          color: "#05120d",
                        }}
                      >
                        <Icon.Play size="sm" /> Execute
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Execution History Section */}
        <div className={tw.section}>
          <Text as="h2" size="lg" weight="medium" className={tw.sectionTitle}>
            Execution History
          </Text>

          {history.length === 0 ? (
            <Card className={tw.emptyState}>
              <Text as="p" size="md">
                No executed proposals yet
              </Text>
            </Card>
          ) : (
            <div className={tw.historyList}>
              {history.map((entry) => (
                <Card key={entry.id} className={tw.historyCard}>
                  <div className={tw.historyHeader}>
                    <div className={tw.historyType}>
                      <Badge
                        size="sm"
                        style={{
                          backgroundColor: `${getTypeColor(entry.type)}20`,
                          color: getTypeColor(entry.type),
                        }}
                      >
                        {entry.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <Text as="span" size="sm" variant="secondary">
                      {formatDate(entry.executedAt)}
                    </Text>
                  </div>

                  <Text as="h4" size="md" weight="semi-bold">
                    {entry.title}
                  </Text>

                  <div className={tw.historyMeta}>
                    <Text as="span" size="sm" variant="secondary">
                      Executed by: {shortenAddress(entry.executedBy)}
                    </Text>
                    <Text as="span" size="sm" variant="secondary">
                      Approvals: {entry.requiredApprovals} /{" "}
                      {entry.totalSigners}
                    </Text>
                  </div>

                  <div className={tw.historyStatus}>
                    <Icon.CheckCircle size="sm" className={tw.executedIcon} />
                    <Text
                      as="span"
                      size="sm"
                      style={{ color: "var(--sds-color-feedback-success)" }}
                    >
                      Executed Successfully
                    </Text>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Proposal Details Modal */}
        {isModalOpen && selectedProposal && (
          <Modal visible={isModalOpen} onClose={closeModal}>
            <div className={tw.modalContent}>
              <Text as="h2" size="lg" weight="medium">
                Proposal Details
              </Text>

              <div className={tw.modalSection}>
                <Text as="span" size="sm" variant="secondary">
                  Proposal ID
                </Text>
                <Text as="p" size="md">
                  {selectedProposal.id}
                </Text>
              </div>

              <div className={tw.modalSection}>
                <Text as="span" size="sm" variant="secondary">
                  Title
                </Text>
                <Text as="p" size="md" weight="semi-bold">
                  {selectedProposal.title}
                </Text>
              </div>

              <div className={tw.modalSection}>
                <Text as="span" size="sm" variant="secondary">
                  Description
                </Text>
                <Text as="p" size="md">
                  {selectedProposal.description}
                </Text>
              </div>

              <div className={tw.modalGrid}>
                <div className={tw.modalItem}>
                  <Text as="span" size="sm" variant="secondary">
                    Type
                  </Text>
                  <Badge size="sm">
                    {selectedProposal.type.replace("_", " ")}
                  </Badge>
                </div>
                <div className={tw.modalItem}>
                  <Text as="span" size="sm" variant="secondary">
                    Proposer
                  </Text>
                  <Text as="p" size="md">
                    {shortenAddress(selectedProposal.proposer)}
                  </Text>
                </div>
              </div>

              {selectedProposal.amount && (
                <div className={tw.modalSection}>
                  <Text as="span" size="sm" variant="secondary">
                    Amount
                  </Text>
                  <Text
                    as="p"
                    size="lg"
                    weight="bold"
                    style={{ color: "var(--sds-color-feedback-success)" }}
                  >
                    {selectedProposal.amount} {selectedProposal.tokenSymbol}
                  </Text>
                </div>
              )}

              {selectedProposal.targetAddress && (
                <div className={tw.modalSection}>
                  <Text as="span" size="sm" variant="secondary">
                    Target Address
                  </Text>
                  <Text as="p" size="md" className={tw.address}>
                    {selectedProposal.targetAddress}
                  </Text>
                </div>
              )}

              <div className={tw.modalSection}>
                <Text as="span" size="sm" variant="secondary">
                  Approval Status
                </Text>
                <div className={tw.modalApprovals}>
                  <Text as="p" size="md" weight="semi-bold">
                    {selectedProposal.currentApprovals} of{" "}
                    {selectedProposal.requiredApprovals} required approvals
                  </Text>
                  <div className={tw.modalSignersList}>
                    {selectedProposal.signers.map((signer) => (
                      <div
                        key={signer.address}
                        className={`${tw.modalSigner} ${
                          signer.hasSigned ? tw.modalSigned : ""
                        }`}
                      >
                        {signer.hasSigned ? (
                          <Icon.CheckCircle
                            size="sm"
                            style={{ color: "#00e5a0" }}
                          />
                        ) : (
                          <div className={tw.modalPendingDot} />
                        )}
                        <Text as="span" size="sm">
                          {shortenAddress(signer.address)}
                          {signer.isCurrentUser && <span> (You)</span>}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={tw.modalActions}>
                <Button variant="secondary" size="md" onClick={closeModal}>
                  Close
                </Button>

                {config?.isCurrentUserSigner &&
                  !selectedProposal.hasApproved &&
                  !selectedProposal.isExecuted && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleApprove(selectedProposal.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader size="sm" /> : "Approve Proposal"}
                    </Button>
                  )}

                {canExecute(selectedProposal) &&
                  config?.isCurrentUserSigner && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleExecute(selectedProposal.id)}
                      disabled={isProcessing}
                      style={{ backgroundColor: "#00e5a0", color: "#05120d" }}
                    >
                      {isProcessing ? <Loader size="sm" /> : "Execute Proposal"}
                    </Button>
                  )}
              </div>
            </div>
          </Modal>
        )}
      </Layout.Inset>
    </Layout.Content>
  );
};

export default GovernanceOverview;
