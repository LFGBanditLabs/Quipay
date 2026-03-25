import { useState } from "react";
import { Mail, Search, ShieldCheck } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  UserAvatar,
} from "@/components/ui";

function UIPrimitivesPreview() {
  const [email, setEmail] = useState("");

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            UI Primitives Preview
          </h1>
          <p className="text-sm text-muted-foreground">
            Live playground for Button, Modal, Card, Input, Badge, Tooltip, and
            Avatar.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="sm">
              Primary sm
            </Button>
            <Button variant="secondary" size="md">
              Secondary md
            </Button>
            <Button variant="ghost" size="lg">
              Ghost lg
            </Button>
            <Button variant="danger" size="md">
              Danger md
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Badges</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="active">Active</Badge>
            <Badge variant="paused">Paused</Badge>
            <Badge variant="completed">Completed</Badge>
            <Badge variant="warning">Warning</Badge>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Input</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Work email"
              placeholder="you@quipay.xyz"
              icon={<Mail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="Used for payroll notifications"
            />
            <Input
              label="Search wallet"
              placeholder="G..."
              icon={<Search />}
              iconPosition="end"
              error="Wallet address is invalid"
              defaultValue="G123"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Avatar</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar size="lg">
              <AvatarImage src="https://i.pravatar.cc/80?img=11" alt="Alice" />
              <AvatarFallback>AL</AvatarFallback>
            </Avatar>
            <UserAvatar name="Treasury Wallet" size="default" />
            <UserAvatar name="Marina Quinn" size="sm" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tooltip</h2>
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              Hover or focus me
            </TooltipTrigger>
            <TooltipContent side="top">
              <ShieldCheck className="size-3.5" />
              Accessible tooltip content
            </TooltipContent>
          </Tooltip>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Card + Modal</h2>
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Payroll batch #23</CardTitle>
              <CardDescription>
                This card demonstrates the glassmorphic container and glow hover
                effect.
              </CardDescription>
              <CardAction>
                <Badge variant="active">Active</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                12 recipients · 3200 XLM total · next execution in 2h
              </p>
            </CardContent>
            <CardFooter className="justify-end">
              <Modal>
                <ModalTrigger render={<Button variant="primary" size="md" />}>
                  Open Modal
                </ModalTrigger>
                <ModalContent>
                  <ModalHeader>
                    <ModalTitle>Confirm payroll execution</ModalTitle>
                    <ModalDescription>
                      Review recipients and submit this payroll batch.
                    </ModalDescription>
                  </ModalHeader>
                  <ModalFooter className="justify-end">
                    <Button variant="ghost" size="md">
                      Cancel
                    </Button>
                    <Button variant="danger" size="md">
                      Execute
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </CardFooter>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

export default UIPrimitivesPreview;
