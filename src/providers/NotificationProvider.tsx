import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import "./NotificationProvider.css"; // Import CSS for sliding effect

type NotificationType =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";
interface NotificationAction {
  label: string;
  onClick: () => void;
}

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  isVisible: boolean;
  action?: NotificationAction;
}

interface NotificationContextType {
  addNotification: (
    message: string,
    type: NotificationType,
    action?: NotificationAction,
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: NotificationType, action?: NotificationAction) => {
      const newNotification: Notification = {
        id: `${type}-${Date.now().toString()}`,
        message,
        type,
        isVisible: true,
        action,
      };
      setNotifications((prev) => [...prev, newNotification]);

      // If it has an action, we might want to keep it longer or require manual dismissal
      // But for now, let's just keep the existing timing or slightly longer if there's an action
      const duration = action ? 8000 : 2500;
      const removeAfter = action ? 10000 : 5000;

      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === newNotification.id ? { ...n, isVisible: false } : n,
          ),
        );
      }, duration);

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== newNotification.id),
        );
      }, removeAfter);
    },
    [],
  );

  const contextValue = useMemo(() => ({ addNotification }), [addNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <div className="notification-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification ${notification.type} ${notification.isVisible ? "slide-in" : "slide-out"}`}
          >
            <div className="notification-content">
              <p>{notification.message}</p>
              {notification.action && (
                <button
                  className="notification-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.action?.onClick();
                    // Optionally dismiss after action
                  }}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export { NotificationContext };
export type { NotificationContextType };
