import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorMessage, LoadingState } from '../components/StateViews';
import { AddressForm } from '../features/addresses/AddressForm';
import { AddressText } from '../features/addresses/AddressText';
import type { Address } from '../features/addresses/types';
import { useAddresses, useCreateAddress, useDeleteAddress, useUpdateAddress } from '../features/addresses/useAddresses';

function AddressCard({ address, onEdit }: { address: Address; onEdit: () => void }) {
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const busy = update.isPending || remove.isPending;

  return (
    <li className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <AddressText address={address} />
        {address.isDefault && <span className="chip bg-primary text-secondary">Default</span>}
      </div>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" className="btn-tertiary text-body-sm" onClick={onEdit} disabled={busy}>
          Edit
        </button>
        {!address.isDefault && (
          <button
            type="button"
            className="btn-tertiary text-body-sm"
            disabled={busy}
            onClick={() => update.mutate({ id: address.id, input: { isDefault: true } })}
          >
            Make default
          </button>
        )}
        <button
          type="button"
          className="btn-tertiary text-body-sm text-error"
          disabled={busy}
          onClick={() => {
            if (window.confirm('Delete this address? Past orders keep their own copy.')) remove.mutate(address.id);
          }}
        >
          {remove.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {(update.error ?? remove.error) && <ErrorMessage>{(update.error ?? remove.error)!.message}</ErrorMessage>}
    </li>
  );
}

export function AddressesPage() {
  const addresses = useAddresses();
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'edit'; address: Address }>({ kind: 'list' });

  if (addresses.isPending) return <LoadingState label="Loading addresses…" />;

  return (
    <section className="mx-auto max-w-4xl px-4 py-9.5">
      <p className="text-body-sm text-primary-60">
        <Link to="/profile" className="hover:underline">
          Profile
        </Link>{' '}
        / Addresses
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-headline-lg uppercase">Addresses</h1>
        {mode.kind === 'list' && (
          <button type="button" className="btn-primary" onClick={() => setMode({ kind: 'new' })}>
            Add address
          </button>
        )}
      </div>

      {addresses.isError && (
        <div className="mt-5">
          <ErrorMessage>{addresses.error.message}</ErrorMessage>
        </div>
      )}

      {mode.kind === 'new' && (
        <div className="card mt-7.5 p-5">
          <h2 className="mb-4 text-headline-sm uppercase">New address</h2>
          <AddressForm
            submitLabel="Save address"
            pending={create.isPending}
            error={create.error}
            onSubmit={(input) => create.mutate(input, { onSuccess: () => setMode({ kind: 'list' }) })}
            onCancel={() => {
              create.reset();
              setMode({ kind: 'list' });
            }}
          />
        </div>
      )}

      {mode.kind === 'edit' && (
        <div className="card mt-7.5 p-5">
          <h2 className="mb-4 text-headline-sm uppercase">Edit address</h2>
          <AddressForm
            initial={mode.address}
            submitLabel="Save changes"
            pending={update.isPending}
            error={update.error}
            onSubmit={(input) =>
              update.mutate({ id: mode.address.id, input }, { onSuccess: () => setMode({ kind: 'list' }) })
            }
            onCancel={() => {
              update.reset();
              setMode({ kind: 'list' });
            }}
          />
        </div>
      )}

      {mode.kind === 'list' && addresses.data && (
        addresses.data.length === 0 ? (
          <div className="mt-7.5 rounded-lg border border-dashed border-primary-20 px-5 py-12.5 text-center">
            <h2 className="text-headline-sm uppercase">No saved addresses</h2>
            <p className="mt-2 text-body-sm text-primary-60">Add one to speed up checkout.</p>
          </div>
        ) : (
          <ul className="mt-7.5 grid gap-4 sm:grid-cols-2">
            {addresses.data.map((address) => (
              <AddressCard key={address.id} address={address} onEdit={() => setMode({ kind: 'edit', address })} />
            ))}
          </ul>
        )
      )}
    </section>
  );
}
