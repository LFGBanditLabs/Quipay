import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  Text,
  Badge,
  Modal,
  Notification,
  Progress,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { voteOnProposal, executeProposal } from "../util/daoService";

export interface Proposal {
  id: string;
  proposal_type: string;
  title: string;
  description: string;
  proposer: string;
  created_at: number;
  voting_deadline: number;
  execution_delay: number;
  status: string;
  votes_for: number;
  votes_against: number;
  required_votes: number;
  has_voted: string[];
  payload: any;
}

interface VotingInterfaceProps {
  proposal: Proposal;
  onUpdate?: () => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({ proposal, onUpdate }) => {
  const { address, signTransaction } = useWallet();
  const [isVoting, setIsVoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const hasVoted = address && proposal.has_voted.includes(address);
  const canVote = address && !hasVoted && proposal.status === "Active";
  const canExecute = address && proposal.status === "Approved" && Date.now() / 1000 > proposal.created_at + proposal.execution_delay;
  const isExpired = Date.now() / 1000 > proposal.voting_deadline && proposal.status === "Active";

  const handleVote = async (voteFor: boolean) => {
    if (!address || !signTransaction) {
      setNotification({
        message: "Please connect your wallet",
        type: "error",
      });
      return;
    }

    setIsVoting(true);
    setNotification(null);

    try {
      await voteOnProposal(proposal.id, address, voteFor, signTransaction);

      setNotification({
        message: voteFor ? "Vote submitted successfully" : "Vote against submitted successfully",
        type: "success",
      });

      onUpdate?.();

    } catch (error) {
      console.error("Failed to vote:", error);
      setNotification({
        message: "Failed to submit vote",
        type: "error",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleExecute = async () => {
    if (!address || !signTransaction) {
      setNotification({
        message: "Please connect your wallet",
        type: "error",
      });
      return;
    }

    setIsExecuting(true);
    setNotification(null);

    try {
      await executeProposal(proposal.id, address, signTransaction);

      setNotification({
        message: "Proposal executed successfully",
        type: "success",
      });

      onUpdate?.();

    } catch (error) {
      console.error("Failed to execute proposal:", error);
      setNotification({
        message: "Failed to execute proposal",
        type: "error",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "var(--sds-color-feedback-warning)";
      case "Approved":
        return "var(--sds-color-feedback-success)";
      case "Executed":
        return "var(--sds-color-feedback-info)";
      case "Expired":
        return "var(--muted)";
      case "Canceled":
        return "var(--sds-color-feedback-error)";
      default:
        return "var(--muted)";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return "clock";
      case "Approved":
        return "check";
      case "Executed":
        return "checkCircle";
      case "Expired":
        return "x";
      case "Canceled":
        return "xCircle";
      default:
        return "helpCircle";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatTimeRemaining = (deadline: number) => {
    const now = Date.now() / 1000;
    const remaining = deadline - now;
    
    if (remaining <= 0) return "Expired";
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const renderPayloadDetails = () => {
    const payload = proposal.payload;
    
    if (payload.CreateStream) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Create Stream</Text>
          <Text as="p" size="sm"><strong>Employer:</strong> {payload.CreateStream.employer}</Text>
          <Text as="p" size="sm"><strong>Worker:</strong> {payload.CreateStream.worker}</Text>
          <Text as="p" size="sm"><strong>Token:</strong> {payload.CreateStream.token}</Text>
          <Text as="p" size="sm"><strong>Rate:</strong> {payload.CreateStream.rate}</Text>
          <Text as="p" size="sm"><strong>Start:</strong> {formatTimestamp(payload.CreateStream.start_ts)}</Text>
          <Text as="p" size="sm"><strong>End:</strong> {formatTimestamp(payload.CreateStream.end_ts)}</Text>
        </div>
      );
    }
    
    if (payload.CancelStream) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Cancel Stream</Text>
          <Text as="p" size="sm"><strong>Stream ID:</strong> {payload.CancelStream.stream_id}</Text>
        </div>
      );
    }
    
    if (payload.UpdateStream) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Update Stream</Text>
          <Text as="p" size="sm"><strong>Stream ID:</strong> {payload.UpdateStream.stream_id}</Text>
          {payload.UpdateStream.new_rate && (
            <Text as="p" size="sm"><strong>New Rate:</strong> {payload.UpdateStream.new_rate}</Text>
          )}
          {payload.UpdateStream.new_end_ts && (
            <Text as="p" size="sm"><strong>New End:</strong> {formatTimestamp(payload.UpdateStream.new_end_ts)}</Text>
          )}
        </div>
      );
    }
    
    if (payload.Transfer) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Transfer</Text>
          <Text as="p" size="sm"><strong>Token:</strong> {payload.Transfer.token}</Text>
          <Text as="p" size="sm"><strong>To:</strong> {payload.Transfer.to}</Text>
          <Text as="p" size="sm"><strong>Amount:</strong> {payload.Transfer.amount}</Text>
        </div>
      );
    }
    
    if (payload.AdminChange) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Admin Change</Text>
          <Text as="p" size="sm"><strong>New Admin:</strong> {payload.AdminChange.new_admin}</Text>
        </div>
      );
    }
    
    if (payload.ThresholdChange) {
      return (
        <div className="space-y-2">
          <Text as="p" size="sm"><strong>Type:</strong> Threshold Change</Text>
          <Text as="p" size="sm"><strong>New Threshold:</strong> {payload.ThresholdChange.new_threshold}</Text>
        </div>
      );
    }
    
    return <Text as="p" size="sm">Unknown proposal type</Text>;
  };

  const voteProgress = (proposal.votes_for / proposal.required_votes) * 100;

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Badge
              variant="default"
              style={{
                backgroundColor: `${getStatusColor(proposal.status)}20`,
                color: getStatusColor(proposal.status),
                borderColor: getStatusColor(proposal.status),
              }}
            >
              {proposal.status}
            </Badge>
            <Text as="span" size="sm" variant="secondary">
              #{proposal.id}
            </Text>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDetails(true)}
          >
            View Details
          </Button>
        </div>

        <Text as="h3" size="md" weight="semi-bold" className="mb-2">
          {proposal.title}
        </Text>

        <Text as="p" size="sm" variant="secondary" className="mb-4 line-clamp-3">
          {proposal.description}
        </Text>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Text as="span" size="sm" variant="secondary">
              Votes For
            </Text>
            <Text as="div" size="lg" weight="bold" style={{ color: "var(--sds-color-feedback-success)" }}>
              {proposal.votes_for}
            </Text>
          </div>
          <div>
            <Text as="span" size="sm" variant="secondary">
              Votes Against
            </Text>
            <Text as="div" size="lg" weight="bold" style={{ color: "var(--sds-color-feedback-error)" }}>
              {proposal.votes_against}
            </Text>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Text as="span" size="sm" variant="secondary">
              Progress ({proposal.votes_for}/{proposal.required_votes} required)
            </Text>
            <Text as="span" size="sm" weight="semi-bold">
              {Math.round(voteProgress)}%
            </Text>
          </div>
          <Progress
            percent={Math.min(voteProgress, 100)}
            variant={proposal.votes_for >= proposal.required_votes ? "success" : "default"}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <Text as="span" size="sm" variant="secondary">
            Time remaining
          </Text>
          <Text as="span" size="sm" weight="semi-bold">
            {formatTimeRemaining(proposal.voting_deadline)}
          </Text>
        </div>

        {hasVoted && (
          <div className="mb-4">
            <Badge variant="success" size="sm">
              You have voted
            </Badge>
          </div>
        )}

        <div className="flex gap-3">
          {canVote && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleVote(true)}
                disabled={isVoting}
                style={{ backgroundColor: "var(--sds-color-feedback-success)" }}
              >
                {isVoting ? "Voting..." : "Vote For"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVote(false)}
                disabled={isVoting}
                style={{ borderColor: "var(--sds-color-feedback-error)", color: "var(--sds-color-feedback-error)" }}
              >
                {isVoting ? "Voting..." : "Vote Against"}
              </Button>
            </>
          )}

          {canExecute && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting}
              style={{ backgroundColor: "var(--sds-color-feedback-info)" }}
            >
              {isExecuting ? "Executing..." : "Execute Proposal"}
            </Button>
          )}

          {isExpired && (
            <Badge variant="warning" size="sm">
              Voting Expired
            </Badge>
          )}
        </div>
      </Card>

      {/* Details Modal */}
      <Modal visible={showDetails} onClose={() => setShowDetails(false)}>
        <div className="p-6 max-w-2xl w-full">
          <Text as="h2" size="lg" weight="medium" className="mb-6">
            Proposal Details
          </Text>

          <div className="space-y-6">
            <div>
              <Text as="h3" size="md" weight="medium" className="mb-3">
                Basic Information
              </Text>
              <div className="space-y-2">
                <Text as="p" size="sm"><strong>ID:</strong> #{proposal.id}</Text>
                <Text as="p" size="sm"><strong>Type:</strong> {proposal.proposal_type}</Text>
                <Text as="p" size="sm"><strong>Proposer:</strong> {proposal.proposer}</Text>
                <Text as="p" size="sm"><strong>Created:</strong> {formatTimestamp(proposal.created_at)}</Text>
                <Text as="p" size="sm"><strong>Voting Deadline:</strong> {formatTimestamp(proposal.voting_deadline)}</Text>
                <Text as="p" size="sm"><strong>Execution Delay:</strong> {proposal.execution_delay} seconds</Text>
              </div>
            </div>

            <div>
              <Text as="h3" size="md" weight="medium" className="mb-3">
                Content
              </Text>
              <div className="space-y-3">
                <div>
                  <Text as="p" size="sm" weight="semi-bold" className="mb-2">Title</Text>
                  <Text as="p" size="sm">{proposal.title}</Text>
                </div>
                <div>
                  <Text as="p" size="sm" weight="semi-bold" className="mb-2">Description</Text>
                  <Text as="p" size="sm">{proposal.description}</Text>
                </div>
              </div>
            </div>

            <div>
              <Text as="h3" size="md" weight="medium" className="mb-3">
                Proposal Payload
              </Text>
              {renderPayloadDetails()}
            </div>

            <div>
              <Text as="h3" size="md" weight="medium" className="mb-3">
                Voting Status
              </Text>
              <div className="space-y-2">
                <Text as="p" size="sm"><strong>Status:</strong> {proposal.status}</Text>
                <Text as="p" size="sm"><strong>Votes For:</strong> {proposal.votes_for}</Text>
                <Text as="p" size="sm"><strong>Votes Against:</strong> {proposal.votes_against}</Text>
                <Text as="p" size="sm"><strong>Required Votes:</strong> {proposal.required_votes}</Text>
                <Text as="p" size="sm"><strong>Total Voters:</strong> {proposal.has_voted.length}</Text>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowDetails(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Notification */}
      {notification && (
        <Notification
          variant={notification.type}
          onClose={() => setNotification(null)}
          title={notification.type === "success" ? "Success" : "Error"}
          className="fixed top-4 right-4 z-50"
        >
          {notification.message}
        </Notification>
      )}
    </>
  );
};

export default VotingInterface;
