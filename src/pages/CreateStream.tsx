import React from "react";
import { Layout, Text } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import StreamCreator from "../components/StreamCreator";

/**
 * CreateStream page
 * Renders the StreamCreator form inside the standard app layout.
 * Navigates back to /dashboard on success or cancel.
 */
const CreateStream: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Give the success message a moment to show before navigating away
    setTimeout(() => {
      void navigate("/dashboard");
    }, 3500);
  };

  const handleCancel = () => {
    void navigate("/dashboard");
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        <Text
          as="h1"
          size="xl"
          weight="medium"
          style={{ marginBottom: "24px" }}
        >
          New Payroll Stream
        </Text>

        <StreamCreator onSuccess={handleSuccess} onCancel={handleCancel} />
      </Layout.Inset>
    </Layout.Content>
  );
};

export default CreateStream;
