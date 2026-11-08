import { ActivityTable } from './_components/activity-table';

// The page title/description live in the app shell's top bar (see
// AppLayout + page-headers.ts), not here — this page only owns its content.
export default function ActivityPage() {
  return <ActivityTable />;
}
