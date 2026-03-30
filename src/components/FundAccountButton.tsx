import React, { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "../hooks/useNotification.ts";
import { useWallet } from "../hooks/useWallet.ts";
import { Button, Tooltip } from "@stellar/design-system";
import { getFriendbotUrl } from "../util/friendbot";

const FundAccountButton: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification, addStreamNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const { address } = useWallet();

  if (!address) return null;

  const handleFundAccount = () => {
    const fund = async () => {
      try {
        const response = await fetch(getFriendbotUrl(address));

        if (response.ok) {
          addNotification(t("fund.success"), "success");
          addStreamNotification("stream_funded", {
            message: "Treasury funding succeeded and streams can stay solvent.",
          });
        } else {
          const body: unknown = await response.json();
          if (
            body !== null &&
            typeof body === "object" &&
            "detail" in body &&
            typeof body.detail === "string"
          ) {
            addNotification(
              t("fund.error_detail", { detail: body.detail }),
              "error",
            );
          } else {
            addNotification(t("fund.error_unknown"), "error");
          }
        }
      } catch {
        addNotification(t("fund.error_retry"), "error");
      }
    };

    startTransition(() => {
      void fund();
    });
  };

  return (
    <div
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <Tooltip
        isVisible={isTooltipVisible}
        isContrast
        title={t("fund.title")}
        placement="bottom"
        triggerEl={
          <Button
            disabled={isPending}
            onClick={handleFundAccount}
            variant="primary"
            size="md"
          >
            {t("fund.title")}
          </Button>
        }
      >
        <div style={{ width: "13em" }}>{t("fund.already_funded")}</div>
      </Tooltip>
    </div>
  );
};

export default FundAccountButton;
