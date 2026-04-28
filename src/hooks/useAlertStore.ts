import { useState, useEffect } from "react";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertCategory =
  | "treasury"
  | "network"
  | "wallet"
  | "protocol"
  | "system";

export interface ProtocolAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismissMs?: number;
}

class AlertStore {
  private alerts: ProtocolAlert[] = [];
  private listeners: Set<() => void> = new Set();
  private maxAlerts = 50;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  getAlerts() {
    return this.alerts;
  }

  addAlert(alert: Omit<ProtocolAlert, "id" | "timestamp" | "read">) {
    const recent = this.alerts.find(
      (item) =>
        item.title === alert.title && Date.now() - item.timestamp < 60_000,
    );
    if (recent) return recent.id;

    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: ProtocolAlert = {
      ...alert,
      id,
      timestamp: Date.now(),
      read: false,
    };

    this.alerts = [next, ...this.alerts].slice(0, this.maxAlerts);
    this.notify();

    if (alert.autoDismissMs) {
      setTimeout(() => this.dismissAlert(id), alert.autoDismissMs);
    }

    return id;
  }

  markAsRead(id: string) {
    this.alerts = this.alerts.map((alert) =>
      alert.id === id ? { ...alert, read: true } : alert,
    );
    this.notify();
  }

  markAllRead() {
    this.alerts = this.alerts.map((alert) => ({ ...alert, read: true }));
    this.notify();
  }

  dismissAlert(id: string) {
    this.alerts = this.alerts.filter((alert) => alert.id !== id);
    this.notify();
  }

  clearAll() {
    this.alerts = [];
    this.notify();
  }

  getUnreadCount() {
    return this.alerts.filter((alert) => !alert.read).length;
  }
}

export const alertStore = new AlertStore();

export function useAlertStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    return alertStore.subscribe(() => forceRender((count) => count + 1));
  }, []);

  return {
    alerts: alertStore.getAlerts(),
    unreadCount: alertStore.getUnreadCount(),
    addAlert: alertStore.addAlert.bind(alertStore),
    markAsRead: alertStore.markAsRead.bind(alertStore),
    markAllRead: alertStore.markAllRead.bind(alertStore),
    dismissAlert: alertStore.dismissAlert.bind(alertStore),
    clearAll: alertStore.clearAll.bind(alertStore),
  };
}
