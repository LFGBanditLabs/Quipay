import React from "react";
import renderer from "react-test-renderer";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/Loading/Spinner";
import {
  Skeleton,
  SkeletonCard,
  SkeletonRow,
} from "@/components/Loading/Skeleton";
import { StreamCardSkeleton } from "@/components/dashboard/StreamCardSkeleton";
import { EarningsSkeleton } from "@/components/dashboard/EarningsSkeleton";
import { VaultBalanceSkeleton } from "@/components/dashboard/VaultBalanceSkeleton";
import EmptyState from "@/components/EmptyState";
import Tooltip from "@/components/Tooltip";
import { Box } from "@/components/layout/Box";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@stellar/design-system", () => {
  const ReactLib = jest.requireActual<typeof import("react")>("react");

  type MockProps = {
    children?: React.ReactNode;
    [key: string]: unknown;
  };

  const Simple = ({ children, ...props }: MockProps) =>
    ReactLib.createElement("span", props, children);

  return {
    Text: ({ children, ...props }: MockProps) =>
      ReactLib.createElement("span", props, children),
    Button: ({ children, ...props }: MockProps) =>
      ReactLib.createElement("button", props, children),
    Icon: {
      InfoCircle: Simple,
      Circle: Simple,
      CloudOff: Simple,
      Activity: Simple,
      AlertCircle: Simple,
    },
  };
});

describe("frontend component snapshots", () => {
  it("renders Button", () => {
    const tree = renderer
      .create(<Button variant="primary">Pay Salary</Button>)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Card composition", () => {
    const tree = renderer
      .create(
        <Card>
          <CardHeader>
            <CardTitle>Payroll Summary</CardTitle>
            <CardDescription>Weekly stats</CardDescription>
            <CardAction>
              <Badge variant="active">Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>Current stream activity</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Input with validation", () => {
    const tree = renderer
      .create(
        <Input
          label="Recipient"
          placeholder="G..."
          error="Address required"
          value=""
          onChange={() => undefined}
        />,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Badge", () => {
    const tree = renderer
      .create(<Badge variant="warning">Pending</Badge>)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Spinner", () => {
    const tree = renderer
      .create(<Spinner size="lg" label="Syncing" />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Skeleton variants", () => {
    const tree = renderer
      .create(
        <Box gap="md">
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="circle" width="40px" height="40px" />
          <Skeleton variant="rect" width="100%" height="24px" />
        </Box>,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders SkeletonCard", () => {
    const tree = renderer.create(<SkeletonCard lines={4} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders SkeletonRow", () => {
    const tree = renderer.create(<SkeletonRow />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders StreamCardSkeleton", () => {
    const tree = renderer.create(<StreamCardSkeleton />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders EarningsSkeleton", () => {
    const tree = renderer.create(<EarningsSkeleton />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders VaultBalanceSkeleton", () => {
    const tree = renderer.create(<VaultBalanceSkeleton />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders EmptyState", () => {
    const tree = renderer
      .create(
        <EmptyState
          title="No Streams"
          description="Create your first payroll stream"
          actionLabel="Create stream"
          onAction={() => undefined}
          variant="streams"
        />,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("renders Tooltip", () => {
    const tree = renderer
      .create(<Tooltip content="Current network status" />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
