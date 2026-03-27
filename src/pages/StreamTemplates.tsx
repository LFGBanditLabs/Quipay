/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — @stellar/design-system types are incomplete for Badge, Card, Modal, Icon
import React, { useState, useRef } from "react";
import {
  Layout,
  Text,
  Button,
  Card,
  Icon,
  Modal,
  Input,
} from "@stellar/design-system";
import {
  useStreamTemplates,
  StreamTemplate,
} from "../hooks/useStreamTemplates";
import { useNotification } from "../hooks/useNotification";
import { useNavigate } from "react-router-dom";
import { SeoHelmet } from "../components/seo/SeoHelmet";

const StreamTemplates: React.FC = () => {
  const {
    templates,
    deleteTemplate,
    updateTemplate,
    exportTemplates,
    importTemplates,
  } = useStreamTemplates();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingTemplate, setEditingTemplate] = useState<StreamTemplate | null>(
    null,
  );
  const [editForm, setEditForm] = useState<Partial<StreamTemplate>>({});

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          importTemplates(imported);
          addNotification("Templates imported successfully!", "success");
        } else {
          throw new Error("Invalid format");
        }
      } catch {
        addNotification(
          "Failed to import templates. Invalid JSON file.",
          "error",
        );
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const startEdit = (template: StreamTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      workerName: template.workerName || "",
      workerAddress: template.workerAddress || "",
      amount: template.amount,
      token: template.token,
      frequency: template.frequency,
      duration: template.duration,
    });
  };

  const handleSaveEdit = () => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, editForm);
      setEditingTemplate(null);
      addNotification("Template updated successfully!", "success");
    }
  };

  return (
    <Layout.Content>
      <SeoHelmet
        title="Stream Templates | Quipay"
        description="Manage your reusable stream configurations."
      />
      <Layout.Inset>
        <div className="flex flex-col gap-8 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Text as="h1" size="xl" weight="medium">
                Stream Templates
              </Text>
              <Text as="p" size="md" variant="secondary" className="mt-1">
                Save time by reusing common payment configurations.
              </Text>
            </div>
            <div className="flex gap-3">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size="sm" /> Import
              </Button>
              <Button variant="secondary" size="sm" onClick={exportTemplates}>
                <Icon name="download" size="sm" /> Export
              </Button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-subtle)]">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-4">
                <Icon name="fileText" size="lg" className="text-secondary" />
              </div>
              <Text as="h3" size="lg" weight="bold" className="mb-2">
                No Templates Found
              </Text>
              <Text
                as="p"
                size="md"
                variant="secondary"
                className="mb-6 max-w-sm"
              >
                Create a stream and save it as a template to get started, or
                import an existing templates JSON file.
              </Text>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void navigate("/create-stream");
                }}
              >
                Create New Stream
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] hover:border-indigo-500/30 hover:shadow-lg transition-all flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Text as="h3" size="md" weight="bold">
                        {template.name}
                      </Text>
                      <Text
                        as="p"
                        size="xs"
                        variant="secondary"
                        className="mt-1"
                      >
                        Created{" "}
                        {new Date(template.createdAt).toLocaleDateString()}
                      </Text>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(template)}
                        title="Edit"
                      >
                        <Icon name="edit" size="sm" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        title="Delete"
                      >
                        <Icon name="delete" size="sm" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 mb-6">
                    <div className="flex justify-between border-b border-[var(--border)] pb-2">
                      <Text as="span" size="sm" variant="secondary">
                        Recipient
                      </Text>
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        className="truncate max-w-[150px]"
                        title={template.workerName || template.workerAddress}
                      >
                        {template.workerName || "Unnamed"}
                      </Text>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border)] pb-2">
                      <Text as="span" size="sm" variant="secondary">
                        Amount
                      </Text>
                      <Text as="span" size="sm" weight="medium">
                        {template.amount} {template.token}
                      </Text>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border)] pb-2">
                      <Text as="span" size="sm" variant="secondary">
                        Schedule
                      </Text>
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        className="capitalize"
                      >
                        {template.frequency} ({template.duration} days)
                      </Text>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      void navigate("/create-stream", {
                        state: { templateId: template.id },
                      });
                    }}
                  >
                    Create from template
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout.Inset>

      <Modal
        visible={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
      >
        <Modal.Heading>Edit Template</Modal.Heading>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Template Name
              </label>
              <Input
                id="edit-name"
                fieldSize="md"
                value={editForm.name || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Worker Name
              </label>
              <Input
                id="edit-worker-name"
                fieldSize="md"
                value={editForm.workerName || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm({ ...editForm, workerName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Worker Address
              </label>
              <Input
                id="edit-worker-addr"
                fieldSize="md"
                value={editForm.workerAddress || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm({ ...editForm, workerAddress: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Amount</label>
                <Input
                  id="edit-amount"
                  fieldSize="md"
                  type="number"
                  value={editForm.amount || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditForm({ ...editForm, amount: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Token</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-transparent)] focus:outline-none"
                  value={editForm.token || "USDC"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, token: e.target.value })
                  }
                >
                  <option value="USDC">USDC</option>
                  <option value="XLM">XLM</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Frequency
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-transparent)] focus:outline-none"
                  value={editForm.frequency || "monthly"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, frequency: e.target.value })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Duration (Days)
                </label>
                <Input
                  id="edit-duration"
                  fieldSize="md"
                  type="number"
                  value={editForm.duration || 30}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditForm({
                      ...editForm,
                      duration: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditingTemplate(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout.Content>
  );
};

export default StreamTemplates;
