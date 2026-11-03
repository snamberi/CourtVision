import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
type Props = { children: ReactNode; disabled?: boolean; purchase: () => void; accountId: string | null };
/** Delay the charge, not its refund. Account changes remount and cancel the pending purchase. */
export function UndoPurchase(props: Props) {
  return <PendingPurchase key={props.accountId ?? 'signed-out'} {...props} />;
}
function PendingPurchase({ children, disabled, purchase }: Props) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const action = useRef(purchase);
  useLayoutEffect(() => { action.current = purchase; }, [purchase]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
  };
  return pending ? <span role="status">Purchase pending for 8 seconds. Nothing charged yet. <button onClick={cancel}>Undo purchase</button></span>
    : <button disabled={disabled} onClick={() => {
      setPending(true);
      timer.current = setTimeout(() => { timer.current = null; setPending(false); action.current(); }, 8000);
    }}>{children}</button>;
}
