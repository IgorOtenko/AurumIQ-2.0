'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '@/lib/account/api-client';
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from '@/lib/account/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PasswordChangeForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  const mut = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      reset();
      setSuccessMessage('Password changed successfully.');
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
        <Label htmlFor="change-password-current">Current password</Label>
        <Input
          id="change-password-current"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="change-password-new">New password</Label>
        <Input
          id="change-password-new"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.newPassword ? true : undefined}
          {...register('newPassword')}
        />
        {errors.newPassword?.message && (
          <p className="text-xs text-rose-500" role="alert">
            {errors.newPassword.message}
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
          {mut.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
