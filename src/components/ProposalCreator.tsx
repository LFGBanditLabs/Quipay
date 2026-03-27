import React, { useState } from "react";
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  Text,
  Modal,
  Notification,
} from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { createProposal } from "../util/daoService";

export interface ProposalFormData {
  type: "CreateStream" | "CancelStream" | "UpdateStream" | "Transfer" | "Upgrade" | "AdminChange" | "ThresholdChange";
  title: string;
  description: string;
}

export interface StreamProposalData {
  employer: string;
  worker: string;
  token: string;
  rate: string;
  cliffTs: string;
  startTs: string;
  endTs: string;
  metadataHash?: string;
}

export interface CancelStreamProposalData {
  streamId: string;
}

export interface UpdateStreamProposalData {
  streamId: string;
  newRate?: string;
  newEndTs?: string;
}

export interface TransferProposalData {
  token: string;
  to: string;
  amount: string;
}

export interface UpgradeProposalData {
  newWasmHash: string;
}

export interface AdminChangeProposalData {
  newAdmin: string;
}

export interface ThresholdChangeProposalData {
  newThreshold: string;
}

interface ProposalCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ProposalCreator: React.FC<ProposalCreatorProps> = ({ isOpen, onClose, onSuccess }) => {
  const { address, signTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form data
  const [formData, setFormData] = useState<ProposalFormData>({
    type: "CreateStream",
    title: "",
    description: "",
  });

  // Stream-specific data
  const [streamData, setStreamData] = useState<StreamProposalData>({
    employer: "",
    worker: "",
    token: "",
    rate: "",
    cliffTs: "",
    startTs: "",
    endTs: "",
  });

  const [cancelStreamData, setCancelStreamData] = useState<CancelStreamProposalData>({
    streamId: "",
  });

  const [updateStreamData, setUpdateStreamData] = useState<UpdateStreamProposalData>({
    streamId: "",
    newRate: "",
    newEndTs: "",
  });

  const [transferData, setTransferData] = useState<TransferProposalData>({
    token: "",
    to: "",
    amount: "",
  });

  const [upgradeData, setUpgradeData] = useState<UpgradeProposalData>({
    newWasmHash: "",
  });

  const [adminChangeData, setAdminChangeData] = useState<AdminChangeProposalData>({
    newAdmin: "",
  });

  const [thresholdChangeData, setThresholdChangeData] = useState<ThresholdChangeProposalData>({
    newThreshold: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address || !signTransaction) {
      setNotification({
        message: "Please connect your wallet",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      let payload: any;

      switch (formData.type) {
        case "CreateStream":
          payload = {
            CreateStream: {
              employer: streamData.employer,
              worker: streamData.worker,
              token: streamData.token,
              rate: parseInt(streamData.rate),
              cliff_ts: parseInt(streamData.cliffTs),
              start_ts: parseInt(streamData.startTs),
              end_ts: parseInt(streamData.endTs),
              metadata_hash: streamData.metadataHash || null,
            },
          };
          break;
        case "CancelStream":
          payload = {
            CancelStream: {
              stream_id: parseInt(cancelStreamData.streamId),
            },
          };
          break;
        case "UpdateStream":
          payload = {
            UpdateStream: {
              stream_id: parseInt(updateStreamData.streamId),
              new_rate: updateStreamData.newRate ? parseInt(updateStreamData.newRate) : null,
              new_end_ts: updateStreamData.newEndTs ? parseInt(updateStreamData.newEndTs) : null,
            },
          };
          break;
        case "Transfer":
          payload = {
            Transfer: {
              token: transferData.token,
              to: transferData.to,
              amount: parseInt(transferData.amount),
            },
          };
          break;
        case "Upgrade":
          payload = {
            Upgrade: {
              new_wasm_hash: upgradeData.newWasmHash,
            },
          };
          break;
        case "AdminChange":
          payload = {
            AdminChange: {
              new_admin: adminChangeData.newAdmin,
            },
          };
          break;
        case "ThresholdChange":
          payload = {
            ThresholdChange: {
              new_threshold: parseInt(thresholdChangeData.newThreshold),
            },
          };
          break;
      }

      await createProposal(
        address,
        formData.type,
        formData.title,
        formData.description,
        payload,
        signTransaction
      );

      setNotification({
        message: "Proposal created successfully",
        type: "success",
      });

      // Reset form
      setFormData({
        type: "CreateStream",
        title: "",
        description: "",
      });

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);

    } catch (error) {
      console.error("Failed to create proposal:", error);
      setNotification({
        message: "Failed to create proposal",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProposalFields = () => {
    switch (formData.type) {
      case "CreateStream":
        return (
          <div className="space-y-4">
            <Input
              label="Employer Address"
              placeholder="G..."
              value={streamData.employer}
              onChange={(e) => setStreamData({ ...streamData, employer: e.target.value })}
              required
            />
            <Input
              label="Worker Address"
              placeholder="G..."
              value={streamData.worker}
              onChange={(e) => setStreamData({ ...streamData, worker: e.target.value })}
              required
            />
            <Input
              label="Token Address"
              placeholder="G..."
              value={streamData.token}
              onChange={(e) => setStreamData({ ...streamData, token: e.target.value })}
              required
            />
            <Input
              label="Rate (per second)"
              type="number"
              placeholder="1000000"
              value={streamData.rate}
              onChange={(e) => setStreamData({ ...streamData, rate: e.target.value })}
              required
            />
            <Input
              label="Cliff Timestamp"
              type="number"
              placeholder="1640995200"
              value={streamData.cliffTs}
              onChange={(e) => setStreamData({ ...streamData, cliffTs: e.target.value })}
              required
            />
            <Input
              label="Start Timestamp"
              type="number"
              placeholder="1640995200"
              value={streamData.startTs}
              onChange={(e) => setStreamData({ ...streamData, startTs: e.target.value })}
              required
            />
            <Input
              label="End Timestamp"
              type="number"
              placeholder="1641081600"
              value={streamData.endTs}
              onChange={(e) => setStreamData({ ...streamData, endTs: e.target.value })}
              required
            />
            <Input
              label="Metadata Hash (optional)"
              placeholder="0x..."
              value={streamData.metadataHash}
              onChange={(e) => setStreamData({ ...streamData, metadataHash: e.target.value })}
            />
          </div>
        );

      case "CancelStream":
        return (
          <div className="space-y-4">
            <Input
              label="Stream ID"
              type="number"
              placeholder="1"
              value={cancelStreamData.streamId}
              onChange={(e) => setCancelStreamData({ ...cancelStreamData, streamId: e.target.value })}
              required
            />
          </div>
        );

      case "UpdateStream":
        return (
          <div className="space-y-4">
            <Input
              label="Stream ID"
              type="number"
              placeholder="1"
              value={updateStreamData.streamId}
              onChange={(e) => setUpdateStreamData({ ...updateStreamData, streamId: e.target.value })}
              required
            />
            <Input
              label="New Rate (optional)"
              type="number"
              placeholder="1000000"
              value={updateStreamData.newRate}
              onChange={(e) => setUpdateStreamData({ ...updateStreamData, newRate: e.target.value })}
            />
            <Input
              label="New End Timestamp (optional)"
              type="number"
              placeholder="1641081600"
              value={updateStreamData.newEndTs}
              onChange={(e) => setUpdateStreamData({ ...updateStreamData, newEndTs: e.target.value })}
            />
          </div>
        );

      case "Transfer":
        return (
          <div className="space-y-4">
            <Input
              label="Token Address"
              placeholder="G..."
              value={transferData.token}
              onChange={(e) => setTransferData({ ...transferData, token: e.target.value })}
              required
            />
            <Input
              label="Recipient Address"
              placeholder="G..."
              value={transferData.to}
              onChange={(e) => setTransferData({ ...transferData, to: e.target.value })}
              required
            />
            <Input
              label="Amount"
              type="number"
              placeholder="1000000000"
              value={transferData.amount}
              onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
              required
            />
          </div>
        );

      case "Upgrade":
        return (
          <div className="space-y-4">
            <Input
              label="New WASM Hash"
              placeholder="0x..."
              value={upgradeData.newWasmHash}
              onChange={(e) => setUpgradeData({ ...upgradeData, newWasmHash: e.target.value })}
              required
            />
          </div>
        );

      case "AdminChange":
        return (
          <div className="space-y-4">
            <Input
              label="New Admin Address"
              placeholder="G..."
              value={adminChangeData.newAdmin}
              onChange={(e) => setAdminChangeData({ ...adminChangeData, newAdmin: e.target.value })}
              required
            />
          </div>
        );

      case "ThresholdChange":
        return (
          <div className="space-y-4">
            <Input
              label="New Threshold"
              type="number"
              placeholder="3"
              value={thresholdChangeData.newThreshold}
              onChange={(e) => setThresholdChangeData({ ...thresholdChangeData, newThreshold: e.target.value })}
              required
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={isOpen} onClose={onClose}>
      <div className="p-6 max-w-2xl w-full">
        <Text as="h2" size="lg" weight="medium" className="mb-6">
          Create Governance Proposal
        </Text>

        {notification && (
          <Notification
            variant={notification.type}
            onClose={() => setNotification(null)}
            title={notification.type === "success" ? "Success" : "Error"}
            className="mb-4"
          >
            {notification.message}
          </Notification>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Select
              label="Proposal Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              options={[
                { value: "CreateStream", label: "Create Stream" },
                { value: "CancelStream", label: "Cancel Stream" },
                { value: "UpdateStream", label: "Update Stream" },
                { value: "Transfer", label: "Transfer" },
                { value: "Upgrade", label: "Upgrade" },
                { value: "AdminChange", label: "Admin Change" },
                { value: "ThresholdChange", label: "Threshold Change" },
              ]}
              required
            />
          </div>

          <div>
            <Input
              label="Title"
              placeholder="Enter proposal title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Textarea
              label="Description"
              placeholder="Describe your proposal in detail"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          <Card>
            <Text as="h3" size="md" weight="medium" className="mb-4">
              Proposal Details
            </Text>
            {renderProposalFields()}
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !formData.title || !formData.description}
            >
              {isSubmitting ? "Creating..." : "Create Proposal"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProposalCreator;
