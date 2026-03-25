# UI Primitives

Reusable, Tailwind-styled UI primitives for the Quipay frontend.

## Import

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  UserAvatar,
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui";
```

## Components

### Button

Variants: `primary`, `secondary`, `ghost`, `danger`.
Sizes: `sm`, `md`, `lg`.

```tsx
<Button variant="primary" size="md">Save</Button>
<Button variant="secondary" size="sm">Back</Button>
<Button variant="ghost" size="lg">Learn more</Button>
<Button variant="danger" size="md">Delete</Button>
```

### Modal

Glassmorphic overlay and panel with keyboard/focus management from Base UI Dialog.

```tsx
<Modal>
  <ModalTrigger render={<Button variant="primary">Open</Button>} />
  <ModalContent>
    <ModalHeader>
      <ModalTitle>Confirm action</ModalTitle>
      <ModalDescription>Are you sure you want to continue?</ModalDescription>
    </ModalHeader>
  </ModalContent>
</Modal>
```

### Card

Glassmorphic container with border glow hover effect.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Payroll stream</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Input

Supports label, icon, hint, and error states.

```tsx
<Input
  label="Work email"
  placeholder="you@quipay.xyz"
  icon={<Mail />}
  hint="Used for notifications"
/>

<Input
  label="Wallet"
  placeholder="G..."
  error="Wallet address is invalid"
/>
```

### Badge

Status variants: `active`, `paused`, `completed`, `warning`.

```tsx
<Badge variant="active">Active</Badge>
<Badge variant="paused">Paused</Badge>
<Badge variant="completed">Completed</Badge>
<Badge variant="warning">Warning</Badge>
```

### Tooltip

Accessible tooltip with keyboard and screen reader support.

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger render={<Button variant="secondary">Info</Button>} />
    <TooltipContent side="top">Tooltip content</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Avatar

`UserAvatar` provides wallet/user initials fallback.

```tsx
<UserAvatar name="Treasury Wallet" />
<UserAvatar name="Alice Example" src="https://i.pravatar.cc/80?img=12" />
```

## Live Preview Route

Open `/ui-primitives` in the app to see all components together.
