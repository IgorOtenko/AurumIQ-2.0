'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { updateEmail } from '@/lib/account/api-client';
import {
  updateEmailSchema,
  type UpdateEmailInput,
} from '@/lib/account/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmailUpdateFormProps {
  currentEmail: string;
}

export default function EmailUpdateForm({ currentEmail }: EmailUpdateFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [displayEmail, setDisplayEmail] = useState(currentEmail);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: {
      currentPassword: '',
      newEmail: '',
    },
  });

  const mut = useMutation({
    mutationFn: updateEmail,
    onSuccess: (data) => {
      reset();
      setDisplayEmail(data.email);
      setSuccessMessage(
        'Email updated. You may need to sign in again on other devices.',
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const onSubmit = handleSubmit((values) => {
    setSuccessMessage(null);
    mut.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label>Current email</Label>
        <div
          className="h-8 w-full rounded-lg border border-input bg-muted/30 px-2.5 py-1 text-sm text-muted-foreground"
          aria-readonly="true"
        >
          {displayEmail || '—'}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="update-email-new">New email</Label>
        <Input
          id="update-email-new"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={errors.newEmail ? true : undefined}
          {...register('newEmail')}
        />
        {errors.newEmail?.message && (
          <p className="text-xs text-rose-500" role="alert">
            {errors.newEmail.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="update-email-password">Current password</Label>
        <Input
          id="update-email-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          {...register('currentPassword')}
        />
        {errors.currentPassword?.message && (
          <p className="text-xs text-rose-500" role="alert">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      {mut.isError && (
        <p className="text-sm text-rose-500" role="alert">
          {(mut.error as Error).message}
        </p>
      )}

      {successMessage && (
        <p className="text-sm text-emerald-500" role="status">
          {successMessage}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? 'Updating…' : 'Update email'}
        </Button>
      </div>
    </form>
  );
}
