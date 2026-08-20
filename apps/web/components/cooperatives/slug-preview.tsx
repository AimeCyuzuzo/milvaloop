import { useCooperativeSlugPreview } from '@/lib/cooperatives/use-cooperative-slug-preview';

// Read-only — the address is generated from the cooperative name, never
// user-edited (see AuthService.insertTenantAndMembership for how the real
// one is derived on creation; this is only a live preview of it).
export function CooperativeSlugPreview({ name }: { name: string }) {
  const { slug } = useCooperativeSlugPreview(name);

  if (!slug) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      Unique name: <span className="font-medium">{slug}</span>
    </p>
  );
}
