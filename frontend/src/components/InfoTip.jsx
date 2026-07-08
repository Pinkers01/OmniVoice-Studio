import React, { useState, useRef, useEffect } from 'react';
import './InfoTip.css';

export default function InfoTip({ content }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const tipRef = useRef(null);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') hide();
    };
    const onClick = (e) => {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        hide();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
    };
  }, [open]);

  return (
    <span className="info-tip">
      <button
        type="button"
        ref={triggerRef}
        className="info-tip__trigger"
        aria-label={typeof content === 'string' ? content : 'More info'}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        ⓘ
      </button>
      {open && (
        <span ref={tipRef} className="info-tip__bubble" role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
