import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../api/accountApi';
import { ErrorMessage, LoadingState } from '../components/StateViews';
import { useAuth } from '../features/auth/AuthProvider';

export function ProfilePage() {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const user = state.status === 'signedIn' ? state.user : null;
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (value: string) => accountApi.updateProfile(value),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  if (!user) return <LoadingState />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    save.mutate(name.trim());
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-9.5">
      <h1 className="text-headline-lg uppercase">Profile</h1>

      <div className="mt-7.5 grid gap-5 md:grid-cols-[1fr_280px]">
        <form className="card flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
          <h2 className="text-headline-sm uppercase">Your details</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-label-sm uppercase">
              Name
            </label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-sm uppercase">Email</span>
            <p className="text-body-md">{user.email}</p>
            <p className="text-caption text-primary-60">Managed by your sign-in provider.</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-sm uppercase">Account type</span>
            <p className="text-body-md">{user.role === 'ADMIN' ? 'Administrator' : 'Customer'}</p>
          </div>
          {save.isError && <ErrorMessage>{save.error.message}</ErrorMessage>}
          <div className="flex items-center gap-4">
            <button type="submit" className="btn-primary" disabled={save.isPending || !name.trim() || name.trim() === user.name}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            {saved && (
              <p role="status" className="text-body-sm">
                Saved.
              </p>
            )}
          </div>
        </form>

        <nav aria-label="Account" className="card flex h-fit flex-col gap-2 p-5">
          <Link to="/orders" className="btn-tertiary">
            Your orders →
          </Link>
          <Link to="/addresses" className="btn-tertiary">
            Saved addresses →
          </Link>
          <Link to="/cart" className="btn-tertiary">
            Cart →
          </Link>
        </nav>
      </div>
    </section>
  );
}
