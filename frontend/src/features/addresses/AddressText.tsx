interface AddressLike {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function AddressText({ address }: { address: AddressLike }) {
  return (
    <address className="text-body-sm not-italic">
      <span className="font-semibold">{address.fullName}</span>
      <br />
      {address.line1}
      {address.line2 && (
        <>
          <br />
          {address.line2}
        </>
      )}
      <br />
      {address.city}, {address.state} {address.postalCode}
      <br />
      {address.country}
      <br />
      <span className="text-primary-60">{address.phone}</span>
    </address>
  );
}
