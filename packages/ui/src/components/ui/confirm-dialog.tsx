'use client';

import * as React from 'react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@milvaloop/ui/alert-dialog';
import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { buttonVariants } from '@milvaloop/ui/button';
import { cn } from '@milvaloop/ui/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => Promise<void>;
}

// The one place every consequential, hard-to-undo action across the app
// goes through — approving or rejecting a contribution, removing a
// member, anything where a single stray click would otherwise do
// something real. Built on AlertDialog rather than Dialog specifically
// because AlertDialog has no overlay-click-to-dismiss and no close
// button — the only ways out are the two buttons this component renders.
// `onConfirm` owns the actual mutation; this component only owns the
// pending/error state around calling it, so a caller never has to
// hand-roll that boilerplate per action (see RemoveMemberDialog before
// this existed, or ContributionRowActions' old one-click Approve).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    // AlertDialogAction closes the dialog on click by default (Radix's own
    // behavior) — prevented here so the dialog stays open and shows a
    // pending state for the duration of an async confirm, closing itself
    // only once onConfirm actually resolves.
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) {
          return;
        }
        onOpenChange(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className={cn(variant === 'destructive' && buttonVariants({ variant: 'destructive' }))}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
