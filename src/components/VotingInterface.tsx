/**
 * VotingInterface
 * ─────────────
 * A component for voting on DAO governance proposals.
 *
 * Features
 * ────────
 * • Display proposal details with voting options
 * • Vote for/against with optional reasoning
 * • Show current vote counts and progress
 * • Real-time voting status updates
 * • Integration with DAO governance contract
 * • Execution trigger for approved proposals
 *
 * Dependencies
 * ────────────
 * • Issue #21  – Wallet (useWallet hook / WalletProvider)
 * • DAO governance contract integration
 */

import React, { useState } from "react";
import {
  Button,
  Badge,
  Textarea,
  Modal,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../hooks/useNotification";
import { translateError } from "../util/errors";

const tw = {
  wrapper: "mx-auto max-w-[800px]",
  card: "rounded-xl border border-[var(--sds-color-neutral-border,#e2e8f0)] bg-[var(--sds-color-background-primary,#fff)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]",
  header: "mb-6 flex items-start justify-between gap-4",
  title: "mb-2 text-[1.25rem] font-bold text-[var(--sds-color-content-primary,#0f172a)]",
  subtitle: "m-0 text-sm text-[var(--sds-color-content-secondary,#4b5563)]",
  statusBadge: "ml-auto",
  content: "mb-6",
  description: "mb-4 leading-[1.6] text-[var(--sds-color-content-secondary,#4b5563)]",
  votingSection: "mb-6",
  votingHeader: "mb-4 flex items-center justify-between",
  votingTitle: "text-lg font-semibold",
  voteCounts: "flex items-center gap-4",
  voteCount: "flex items-center gap-2",
  progressBar: "h-3 overflow-hidden rounded bg-[var(--border)]",
  progressFill: "h-full rounded transition-all",
  voteButtons: "flex gap-3",
  voteForm: "mb-4 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface-subtle)]",
  formGroup: "mb-4",
  label: "block mb-2 text-sm font-semibold",
  textarea: "w-full rounded-lg border border-[var(--border)] p-3 text-sm",
  actions: "flex gap-3",
  spinner: "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white align-middle",
  executionSection: "mt-6 p-4 border border-[var(--success-transparent-strong)] rounded-lg bg-[var(--success-transparent)]",
  executionHeader: "mb-2 flex items-center gap-2",
  executionTitle: "font-semibold text-[var(--sds-color-feedback-success)]",
  executionDescription: "text-sm text-[var(--sds-color-content-secondary,#4b5563)] mb-3",
  walletNotice: "flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--muted)]",
  walletNoticeIcon: "text-base leading-6",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  title: string;
  description: string;
  type: "CreateStream" | "CancelStream" | "UpdateStream" | "Transfer" | "Upgrade" | "AdminChange" | "ThresholdChange" | "Custom";
  proposer: string;
  createdAt: Date;
  votingStartsAt: Date;
  votingEndsAt: Date;
  executableAt: Date;
  status: "Pending" | "Approved" | "Rejected" | "Executed" | "Expired";
  votesFor: number;
  votesAgainst: number;
  requiredVotes: number;
  hasVoted: boolean;
  payload?: any;
  executedAt?: Date;
  executedBy?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

interface VotingInterfaceProps {
  proposal: Proposal;
  onVote?: (proposalId: string, inFavor: boolean, reason?: string) => void;
  onExecute?: (proposalId: string) => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({
  proposal,
  onVote,
  onExecute,
}) => {
  const { address } = useWallet();
  const { addNotification } = useNotification();
  const [isVoting, setIsVoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showVoteForm, setShowVoteForm] = useState(false);
  const [voteReason, setVoteReason] = useState("");
  const [selectedVote, setSelectedVote] = useState<"for" | "against" | null>(null);

  // ── Calculations ─────────────────────────────────────────────────────────────

  const now = new Date();
  const votingOpen = proposal.votingStartsAt <= now && now <= proposal.votingEndsAt;
  const votingEnded = now > proposal.votingEndsAt;
  const canVote = votingOpen && !proposal.hasVoted && address;
  const canExecute = proposal.status === "Approved" && now >= proposal.executableAt && address;
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;

  // ── Helper functions ───────────────────────────────────────────────────────

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: Proposal["status"]): string => {
    switch (status) {
      case "Pending":
        return "var(--sds-color-feedback-warning)";
      case "Approved":
        return "var(--sds-color-feedback-success)";
      case "Rejected":
        return "var(--sds-color-feedback-error)";
      case "Executed":
        return "var(--accent)";
      case "Expired":
        return "var(--muted)";
      default:
        return "var(--muted)";
    }
  };

  // ── Vote handlers ───────────────────────────────────────────────────────────

  const handleVoteClick = (inFavor: boolean) => {
    setSelectedVote(inFavor ? "for" : "against");
    setShowVoteForm(true);
  };

  const handleVoteSubmit = async () => {
    if (!address || selectedVote === null) return;

    setIsVoting(true);
    try {
      // TODO: Implement actual contract interaction
      // For now, we'll simulate the vote
      await new Promise(resolve => setTimeout(resolve, 1500));

      const inFavor = selectedVote === "for";
      
      onVote?.(proposal.id, inFavor, voteReason || undefined);
      
      addNotification(
        `Vote ${inFavor ? "for" : "against"} proposal submitted successfully!`,
        "success"
      );

      setShowVoteForm(false);
      setVoteReason("");
      setSelectedVote(null);
    } catch (err: unknown) {
      let message = "An unknown error occurred.";
      if (typeof err === "string") {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      }

      const appError = translateError(err);
      message = appError.actionableStep
        ? `${appError.message} ${appError.actionableStep}`
        : appError.message;

      addNotification(`Vote failed: ${message}`, "error");
    } finally {
      setIsVoting(false);
    }
  };

  // ── Execution handler ───────────────────────────────────────────────────────

  const handleExecute = async () => {
    if (!address) return;

    setIsExecuting(true);
    try {
      // TODO: Implement actual contract interaction
      // For now, we'll simulate the execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      onExecute?.(proposal.id);
      
      addNotification("Proposal executed successfully!", "success");
    } catch (err: unknown) {
      let message = "An unknown error occurred.";
      if (typeof err === "string") {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      }

      const appError = translateError(err);
      message = appError.actionableStep
        ? `${appError.message} ${appError.actionableStep}`
        : appError.message;

      addNotification(`Execution failed: ${message}`, "error");
    } finally {
      setIsExecuting(false);
    }
  };

  if (!address) {
    return (
      <div className={tw.wrapper}>
        <div className={tw.card}>
          <div className={tw.walletNotice}>
            <span className={tw.walletNoticeIcon}>💼</span>
            <p>Connect your wallet to vote on this proposal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={tw.wrapper}>
      <div className={tw.card}>
        {/* Header */}
        <div className={tw.header}>
          <div>
            <h2 className={tw.title}>{proposal.title}</h2>
            <p className={tw.subtitle}>
              Proposed by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)} •{" "}
              {formatDate(proposal.createdAt)}
            </p>
          </div>
          <Badge
            variant="default"
            size="sm"
            className={tw.statusBadge}
            style={{
              backgroundColor: `${getStatusColor(proposal.status)}20`,
              color: getStatusColor(proposal.status),
              borderColor: getStatusColor(proposal.status),
            }}
          >
            {proposal.status}
          </Badge>
        </div>

        {/* Content */}
        <div className={tw.content}>
          <div className={tw.description}>{proposal.description}</div>
          
          {/* Proposal Type */}
          <div style={{ marginBottom: "1rem" }}>
            <Badge size="sm">
              {proposal.type.replace(/([A-Z])/g, " $1").trim()}
            </Badge>
          </div>

          {/* Timeline */}
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            <div>Voting Period: {formatDate(proposal.votingStartsAt)} - {formatDate(proposal.votingEndsAt)}</div>
            <div>Executable After: {formatDate(proposal.executableAt)}</div>
          </div>
        </div>

        {/* Voting Section */}
        {proposal.status !== "Executed" && proposal.status !== "Rejected" && (
          <div className={tw.votingSection}>
            <div className={tw.votingHeader}>
              <h3 className={tw.votingTitle}>Voting Status</h3>
              <div className={tw.voteCounts}>
                <div className={tw.voteCount}>
                  <span style={{ color: "var(--sds-color-feedback-success)" }}>
                    {proposal.votesFor}
                  </span>
                  <span>/</span>
                  <span>{proposal.requiredVotes}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>For</span>
                </div>
                <div className={tw.voteCount}>
                  <span style={{ color: "var(--sds-color-feedback-error)" }}>
                    {proposal.votesAgainst}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Against</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {totalVotes > 0 && (
              <div className={tw.progressBar}>
                <div
                  className={tw.progressFill}
                  style={{
                    width: `${forPercentage}%`,
                    backgroundColor: "var(--sds-color-feedback-success)",
                  }}
                />
                <div
                  className={tw.progressFill}
                  style={{
                    width: `${againstPercentage}%`,
                    backgroundColor: "var(--sds-color-feedback-error)",
                    marginLeft: `-${againstPercentage}%`,
                  }}
                />
              </div>
            )}

            {/* Vote Status */}
            {proposal.hasVoted && (
              <div style={{ 
                padding: "0.75rem", 
                backgroundColor: "var(--surface-subtle)", 
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                color: "var(--muted)",
                textAlign: "center"
              }}>
                You have already voted on this proposal
              </div>
            )}

            {/* Vote Buttons */}
            {canVote && (
              <div className={tw.voteButtons}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleVoteClick(true)}
                  disabled={isVoting}
                  style={{
                    backgroundColor: "var(--sds-color-feedback-success)",
                    color: "#05120d",
                  }}
                >
                  Vote For
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleVoteClick(false)}
                  disabled={isVoting}
                  style={{
                    backgroundColor: "var(--sds-color-feedback-error)",
                    color: "#450a0a",
                  }}
                >
                  Vote Against
                </Button>
              </div>
            )}

            {/* Voting Status Messages */}
            {votingEnded && !proposal.hasVoted && (
              <div style={{ 
                padding: "0.75rem", 
                backgroundColor: "var(--surface-subtle)", 
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                color: "var(--muted)",
                textAlign: "center"
              }}>
                Voting has ended for this proposal
              </div>
            )}

            {!votingOpen && !votingEnded && (
              <div style={{ 
                padding: "0.75rem", 
                backgroundColor: "var(--surface-subtle)", 
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                color: "var(--muted)",
                textAlign: "center"
              }}>
                Voting opens on {formatDate(proposal.votingStartsAt)}
              </div>
            )}
          </div>
        )}

        {/* Execution Section */}
        {canExecute && (
          <div className={tw.executionSection}>
            <div className={tw.executionHeader}>
              <span className={tw.executionTitle}>🎉 Ready to Execute</span>
            </div>
            <div className={tw.executionDescription}>
              This proposal has been approved and is ready for execution. Once executed, the proposed actions will be carried out on-chain.
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleExecute}
              disabled={isExecuting}
              style={{
                backgroundColor: "var(--sds-color-feedback-success)",
                color: "#05120d",
              }}
            >
              {isExecuting ? <span className={tw.spinner} /> : "Execute Proposal"}
            </Button>
          </div>
        )}

        {/* Execution Status */}
        {proposal.status === "Executed" && proposal.executedAt && (
          <div style={{ 
            padding: "1rem", 
            backgroundColor: "var(--success-transparent)", 
            borderRadius: "0.5rem",
            border: "1px solid var(--success-transparent-strong)"
          }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              ✅ Executed Successfully
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              Executed on {formatDate(proposal.executedAt)} by {proposal.executedBy?.slice(0, 6)}...{proposal.executedBy?.slice(-4)}
            </div>
          </div>
        )}
      </div>

      {/* Vote Form Modal */}
      {showVoteForm && (
        <Modal
          visible={showVoteForm}
          onClose={() => {
            setShowVoteForm(false);
            setVoteReason("");
            setSelectedVote(null);
          }}
        >
          <div style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 600 }}>
              Cast Your Vote
            </h3>
            
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "var(--surface-subtle)", 
              borderRadius: "0.5rem",
              marginBottom: "1rem"
            }}>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                You are voting: <span style={{ 
                  color: selectedVote === "for" ? "var(--sds-color-feedback-success)" : "var(--sds-color-feedback-error)"
                }}>
                  {selectedVote === "for" ? "FOR" : "AGAINST"}
                </span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                {selectedVote === "for" 
                  ? "You support this proposal and want it to be executed."
                  : "You oppose this proposal and do not want it to be executed."
                }
              </div>
            </div>

            <div className={tw.formGroup}>
              <label className={tw.label}>
                Reason (Optional)
              </label>
              <Textarea
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                placeholder="Explain your reasoning for this vote..."
                rows={4}
                className={tw.textarea}
              />
            </div>

            <div className={tw.actions}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowVoteForm(false);
                  setVoteReason("");
                  setSelectedVote(null);
                }}
                disabled={isVoting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleVoteSubmit}
                disabled={isVoting}
                style={{
                  backgroundColor: selectedVote === "for" 
                    ? "var(--sds-color-feedback-success)" 
                    : "var(--sds-color-feedback-error)",
                  color: selectedVote === "for" ? "#05120d" : "#450a0a",
                }}
              >
                {isVoting ? <span className={tw.spinner} /> : "Submit Vote"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VotingInterface;
