import React from "react";
import { Layout, Text } from "@stellar/design-system";

const UIPrimitivesPreview: React.FC = () => (
  <Layout.Content>
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <Text as="h1" size="xl" weight="medium" className="mb-4">
        UI Primitives Preview
      </Text>
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
        <Text as="p" size="sm" className="text-slate-300">
          This page is a placeholder for the UI primitives preview and can be
          expanded with component demos, layout samples, and design tokens.
        </Text>
      </div>
    </div>
  </Layout.Content>
);

export default UIPrimitivesPreview;
