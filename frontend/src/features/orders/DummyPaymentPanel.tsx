import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../components/StateViews';
import type { PaymentOutcome } from './types';
import { formatPaise } from '../../lib/money';

interface DummyPaymentPanelProps {
  orderNumber: string;
  totalPaise: number;
  busy: boolean;
  pendingOutcome?: PaymentOutcome;
  error: Error | null;
  onPay: (outcome: PaymentOutcome) => void;
  /** Optional cancel/close action when rendered inside a modal dialog. */
  onDismiss?: () => void;
}

type Step = 'card' | 'otp';

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function DummyPaymentPanel({
  orderNumber,
  totalPaise,
  busy,
  pendingOutcome,
  error,
  onPay,
  onDismiss,
}: DummyPaymentPanelProps) {
  const uid = useId();
  const [step, setStep] = useState<Step>('card');

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCsc, setCardCsc] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const otpHeadingRef = useRef<HTMLHeadingElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
    }
  }, [step]);

  function fillSampleCard() {
    setCardName('Aarav Sharma');
    setCardNumber('4242 4242 4242 4242');
    setCardExp('12/29');
    setCardCsc('424');
    setCardError(null);
  }

  function handleCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = cardNumber.replace(/\s+/g, '');
    if (cardName.trim().length < 2) {
      setCardError('Enter the cardholder name.');
      return;
    }
    if (!/^\d{13,19}$/.test(digits)) {
      setCardError('Enter a valid 13–19 digit dummy card number.');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExp)) {
      setCardError('Enter expiry in MM/YY format.');
      return;
    }
    if (!/^\d{3,4}$/.test(cardCsc)) {
      setCardError('Enter a 3 or 4 digit security code.');
      return;
    }
    setCardError(null);
    setOtpError(null);
    setStep('otp');
  }

  function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Enter the 6-digit OTP to complete payment.');
      return;
    }
    setOtpError(null);
    onPay('SUCCESS');
  }

  const last4 = cardNumber.replace(/\D/g, '').slice(-4) || '••••';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-caption text-primary-60 uppercase">
            {step === 'card' ? 'Step 1 of 2 · Card details' : 'Step 2 of 2 · OTP verification'}
          </p>
          <p className="mt-1 text-headline-md">{formatPaise(totalPaise)}</p>
        </div>
        <span className="chip">Order {orderNumber}</span>
      </div>

      <p className="text-body-sm text-primary-60">
        Demo gateway: enter any dummy card details and 6-digit OTP. No real money moves and no card data is sent to the server.
      </p>

      {error && <ErrorMessage>{error.message}</ErrorMessage>}

      {step === 'card' ? (
        <form className="flex flex-col gap-4" onSubmit={handleCardSubmit} noValidate>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-label-md uppercase">Card information</h3>
            <button type="button" className="btn-tertiary text-body-sm" disabled={busy} onClick={fillSampleCard}>
              Use sample card
            </button>
          </div>

          {cardError && <ErrorMessage>{cardError}</ErrorMessage>}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-cc-name`} className="text-label-sm uppercase">
              Name on card
            </label>
            <input
              id={`${uid}-cc-name`}
              name="cc-name"
              type="text"
              className="input"
              autoComplete="cc-name"
              maxLength={50}
              enterKeyHint="next"
              placeholder="Aarav Sharma"
              value={cardName}
              onChange={(e) => {
                setCardName(e.target.value);
                if (cardError) setCardError(null);
              }}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-cc-number`} className="text-label-sm uppercase">
              Card number
            </label>
            <input
              id={`${uid}-cc-number`}
              name="cc-number"
              type="text"
              className="input font-mono"
              autoComplete="cc-number"
              inputMode="numeric"
              maxLength={19}
              pattern="[\d ]{13,19}"
              enterKeyHint="next"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => {
                setCardNumber(formatCardNumber(e.target.value));
                if (cardError) setCardError(null);
              }}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-cc-exp`} className="text-label-sm uppercase">
                Expiry date
              </label>
              <span id={`${uid}-exp-hint`} className="text-caption text-primary-60">
                Format: MM/YY
              </span>
              <input
                id={`${uid}-cc-exp`}
                name="cc-exp"
                type="text"
                className="input font-mono"
                autoComplete="cc-exp"
                inputMode="numeric"
                maxLength={5}
                pattern="(0[1-9]|1[0-2])\/\d{2}"
                enterKeyHint="next"
                aria-describedby={`${uid}-exp-hint`}
                placeholder="12/29"
                value={cardExp}
                onChange={(e) => {
                  setCardExp(formatExpiry(e.target.value));
                  if (cardError) setCardError(null);
                }}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-cc-csc`} className="text-label-sm uppercase">
                CVV / Security code
              </label>
              <span id={`${uid}-csc-hint`} className="text-caption text-primary-60">
                3 or 4 digits
              </span>
              <input
                id={`${uid}-cc-csc`}
                name="cc-csc"
                type="text"
                className="input font-mono"
                autoComplete="cc-csc"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{3,4}"
                enterKeyHint="done"
                aria-describedby={`${uid}-csc-hint`}
                placeholder="424"
                value={cardCsc}
                onChange={(e) => {
                  setCardCsc(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (cardError) setCardError(null);
                }}
                required
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              Proceed to OTP
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => onPay('FAILED')}>
              {busy && pendingOutcome === 'FAILED' ? 'Updating…' : 'Simulate failure'}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => onPay('CANCELLED')}>
              {busy && pendingOutcome === 'CANCELLED' ? 'Cancelling…' : 'Cancel payment'}
            </button>
            {onDismiss && (
              <button type="button" className="btn-tertiary ml-auto text-body-sm" disabled={busy} onClick={onDismiss}>
                Close
              </button>
            )}
          </div>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleOtpSubmit} noValidate>
          <div className="flex items-center justify-between gap-2">
            <h3 ref={otpHeadingRef} tabIndex={-1} className="text-label-md uppercase">
              Verify OTP for card •••• {last4}
            </h3>
            <button
              type="button"
              className="btn-tertiary text-body-sm"
              disabled={busy}
              onClick={() => {
                setOtp('123456');
                setOtpError(null);
              }}
            >
              Fill 123456
            </button>
          </div>

          {otpError && <ErrorMessage>{otpError}</ErrorMessage>}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-otp`} className="text-label-sm uppercase">
              One-time passcode (OTP)
            </label>
            <p id={`${uid}-otp-hint`} className="text-caption text-primary-60">
              Enter any 6-digit demo code (for example, 123456).
            </p>
            <input
              ref={otpInputRef}
              id={`${uid}-otp`}
              name="otp"
              type="text"
              className="input min-h-12 font-mono text-body-md tracking-[0.35em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              enterKeyHint="done"
              aria-describedby={`${uid}-otp-hint`}
              aria-invalid={Boolean(otpError)}
              placeholder="123456"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (otpError) setOtpError(null);
              }}
              required
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && pendingOutcome === 'SUCCESS' ? 'Processing…' : `Verify & Pay ${formatPaise(totalPaise)}`}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStep('card')}>
              Back to card
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => onPay('FAILED')}>
              {busy && pendingOutcome === 'FAILED' ? 'Updating…' : 'Simulate failure'}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => onPay('CANCELLED')}>
              {busy && pendingOutcome === 'CANCELLED' ? 'Cancelling…' : 'Cancel payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
