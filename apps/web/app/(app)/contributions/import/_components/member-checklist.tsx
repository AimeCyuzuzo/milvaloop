'use client';

import { Button } from '@milvaloop/ui/button';
import { Checkbox } from '@milvaloop/ui/checkbox';
import { Label } from '@milvaloop/ui/label';

export interface ImportMember {
  membershipId: string;
  name: string;
}

// Shared by both fill dialogs — a fill operation always starts with "which
// members does this apply to", regardless of what it fills them with.
export function MemberChecklist({
  members,
  selected,
  onChange,
}: {
  members: ImportMember[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const allSelected = members.length > 0 && selected.length === members.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Members</Label>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => onChange(allSelected ? [] : members.map((member) => member.membershipId))}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </Button>
      </div>
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border p-3">
        {members.map((member) => (
          <div key={member.membershipId} className="flex items-center gap-2">
            <Checkbox
              id={`member-${member.membershipId}`}
              checked={selected.includes(member.membershipId)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, member.membershipId]
                    : selected.filter((id) => id !== member.membershipId),
                )
              }
            />
            <Label htmlFor={`member-${member.membershipId}`}>{member.name}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
