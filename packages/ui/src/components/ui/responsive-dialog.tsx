'use client';

import * as React from 'react';

import { useIsMobile } from '@milvaloop/ui/hooks/use-mobile';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer';

// One composition — Root/Trigger/Content/Header/Title/Description/Footer/
// Close — that renders as an ordinary centered Dialog above the mobile
// breakpoint and a full-height, drag-to-dismiss bottom sheet (see
// drawer.tsx) below it. Nearly every create/edit/confirm flow in this app
// is a Dialog today, and every one of them is a small floating card with
// margins on every side on a phone — a website's popup, not a phone's own
// modal pattern. Swapping the import is meant to be close to the only
// change most call sites need; the sub-component names match Dialog's
// exactly for that reason.
//
// isMobile is read once per mount, not reactively re-switched mid-session
// on a resize/rotate — a dialog that's already open shouldn't change which
// underlying primitive renders it out from under an in-progress
// interaction. A closed dialog opened after a resize picks up the current
// width normally, since the whole tree remounts on open.
const ResponsiveDialogContext = React.createContext(false);

function ResponsiveDialog(props: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();
  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      {isMobile ? <Drawer {...props} /> : <Dialog {...props} />}
    </ResponsiveDialogContext.Provider>
  );
}

function useResponsiveDialogIsMobile() {
  return React.useContext(ResponsiveDialogContext);
}

function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  return useResponsiveDialogIsMobile() ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  return useResponsiveDialogIsMobile() ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

// The one place mobile and desktop genuinely need different content
// wrappers — a fixed-height, internally-scrolling sheet on mobile,
// Dialog's own centered card everywhere else. A caller with content long
// enough to need it (an allocation preview, a long member list) gets a
// real scroll region either way now, where a plain Dialog had none.
function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
  return useResponsiveDialogIsMobile() ? (
    <DrawerContent className={className}>{children}</DrawerContent>
  ) : (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader(props: React.ComponentProps<typeof DialogHeader>) {
  return useResponsiveDialogIsMobile() ? <DrawerHeader {...props} /> : <DialogHeader {...props} />;
}

function ResponsiveDialogFooter(props: React.ComponentProps<typeof DialogFooter>) {
  return useResponsiveDialogIsMobile() ? <DrawerFooter {...props} /> : <DialogFooter {...props} />;
}

function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return useResponsiveDialogIsMobile() ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return useResponsiveDialogIsMobile() ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
