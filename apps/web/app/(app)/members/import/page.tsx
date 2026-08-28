'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MemberImportMapping, MemberImportPreview, MemberImportResult } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { DatePicker } from '@milvaloop/ui/date-picker';
import { Input } from '@milvaloop/ui/input';
import { Label } from '@milvaloop/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';
import { Typography } from '@milvaloop/ui/typography';

import { todayIsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/api/api-fetch';
import { useImportMembersMutation, usePreviewImportMutation } from '@/lib/members/use-members-mutations';

const NO_EMAIL_COLUMN = '__none__';

type Step =
  | { name: 'pick-file' }
  | { name: 'map-columns'; file: File; preview: MemberImportPreview }
  | { name: 'results'; result: MemberImportResult };

// A whole member list at once, from a spreadsheet a cooperative already
// keeps — the same shape as the "select a member, add without email"
// flows in _components/, just for many rows in one pass. Reached from the
// Members page's "Add member" menu, and (see the onboarding wizard) as one
// step of setting up a brand-new cooperative.
export default function ImportMembersPage() {
  const [step, setStep] = useState<Step>({ name: 'pick-file' });
  const [nameColumns, setNameColumns] = useState<[string] | [string, string]>(['']);
  const [emailColumn, setEmailColumn] = useState(NO_EMAIL_COLUMN);
  const [memberSince, setMemberSince] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);

  const preview = usePreviewImportMutation();
  const importMembers = useImportMembersMutation();

  async function handleFileChosen(file: File) {
    setError(null);
    try {
      const result = await preview.mutateAsync(file);
      if (result.columns.length === 0) {
        setError('That file has no columns MilvaLoop could read — is it a valid spreadsheet?');
        return;
      }
      setNameColumns(['']);
      setEmailColumn(NO_EMAIL_COLUMN);
      setStep({ name: 'map-columns', file, preview: result });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleImport(file: File) {
    setError(null);
    const columns = nameColumns.filter((value) => value !== '').map(Number);
    if (columns.length === 0) {
      setError('Choose at least one column for the name.');
      return;
    }
    const mapping: MemberImportMapping = {
      nameColumns: columns,
      emailColumn: emailColumn === NO_EMAIL_COLUMN ? undefined : Number(emailColumn),
      memberSince,
    };
    try {
      const result = await importMembers.mutateAsync({ file, mapping });
      setStep({ name: 'results', result });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {error ? (
        <Typography variant="small" className="text-destructive">
          {error}
        </Typography>
      ) : null}

      {step.name === 'pick-file' ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose a spreadsheet</CardTitle>
            <CardDescription>An .xlsx file with one row per member — headers in the first row.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept=".xlsx"
              disabled={preview.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFileChosen(file);
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {step.name === 'map-columns' ? (
        <Card>
          <CardHeader>
            <CardTitle>Match the columns</CardTitle>
            <CardDescription>Tell MilvaLoop which column is which — the rest of the sheet is ignored.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>Name column</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={nameColumns[0]}
                  onValueChange={(value) =>
                    setNameColumns(nameColumns.length === 2 ? [value, nameColumns[1]] : [value])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a column" />
                  </SelectTrigger>
                  <SelectContent>
                    {step.preview.columns.map((column, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {column || `Column ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {nameColumns.length === 2 ? (
                  <Select value={nameColumns[1]} onValueChange={(value) => setNameColumns([nameColumns[0], value])}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {step.preview.columns.map((column, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {column || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              {nameColumns.length === 1 ? (
                <Button type="button" variant="link" size="sm" className="self-start" onClick={() => setNameColumns([nameColumns[0], ''])}>
                  + Combine another column (e.g. first name + last name)
                </Button>
              ) : (
                <Button type="button" variant="link" size="sm" className="self-start" onClick={() => setNameColumns([nameColumns[0]])}>
                  Use a single column instead
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Email column (optional)</Label>
              <Select value={emailColumn} onValueChange={setEmailColumn}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EMAIL_COLUMN}>None — add everyone without a login</SelectItem>
                  {step.preview.columns.map((column, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Member since</Label>
              <DatePicker value={memberSince} onChange={setMemberSince} />
              <Typography variant="small" color="muted">
                Applied to everyone in this file — adjust an individual member&rsquo;s date afterward from the Members page.
              </Typography>
            </div>

            {step.preview.sampleRows.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {step.preview.columns.map((column, index) => (
                        <TableHead key={index}>{column || `Column ${index + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {step.preview.sampleRows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep({ name: 'pick-file' })}>
                Back
              </Button>
              <Button type="button" disabled={importMembers.isPending} onClick={() => void handleImport(step.file)}>
                {importMembers.isPending ? 'Importing…' : 'Import members'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step.name === 'results' ? (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>
              {step.result.rows.filter((row) => row.outcome === 'invited').length} invited,{' '}
              {step.result.rows.filter((row) => row.outcome === 'added').length} added without a login,{' '}
              {step.result.rows.filter((row) => row.outcome === 'skipped').length} skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {step.result.rows.map((row) => (
                <div key={row.row} className="flex items-center justify-between gap-4">
                  <Typography variant="small">
                    Row {row.row}
                    {row.outcome === 'skipped' ? '' : `: ${row.name}`}
                  </Typography>
                  {row.outcome === 'invited' ? <Badge variant="successSoft">Invited</Badge> : null}
                  {row.outcome === 'added' ? <Badge variant="successSoft">Added</Badge> : null}
                  {row.outcome === 'skipped' ? <Badge variant="destructiveSoft">{row.reason}</Badge> : null}
                </div>
              ))}
            </div>
            <Button asChild className="self-start">
              <Link href="/members">Back to members</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
