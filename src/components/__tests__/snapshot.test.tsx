import React, { act } from "react";
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
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<Button variant="primary">Pay Salary</Button>);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Card composition", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(
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
      );
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Input with validation", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(
        <Input
          label="Recipient"
          placeholder="G..."
          error="Address required"
          value=""
          onChange={() => undefined}
        />,
      );
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Badge", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<Badge variant="warning">Pending</Badge>);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Spinner", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<Spinner size="lg" label="Syncing" />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Skeleton variants", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(
        <Box gap="md">
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="circle" width="40px" height="40px" />
          <Skeleton variant="rect" width="100%" height="24px" />
        </Box>,
      );
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders SkeletonCard", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<SkeletonCard lines={4} />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders SkeletonRow", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<SkeletonRow />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders StreamCardSkeleton", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<StreamCardSkeleton />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders EarningsSkeleton", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<EarningsSkeleton />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders VaultBalanceSkeleton", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<VaultBalanceSkeleton />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders EmptyState", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(
        <EmptyState
          title="No Streams"
          description="Create your first payroll stream"
          actionLabel="Create stream"
          onAction={() => undefined}
          variant="streams"
        />,
      );
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders Tooltip", () => {
    let tree = null as unknown as ReturnType<typeof renderer.create>;
    act(() => {
      tree = renderer.create(<Tooltip content="Current network status" />);
    });
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
