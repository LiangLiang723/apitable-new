import * as React from 'react';

interface ITrialProps {
  setShowTrialModal: (visible: boolean) => void;
  title?: string;
}

export const Trial = ({ setShowTrialModal, title }: ITrialProps) => (
  <div style={{ padding: 24 }}>
    <h2>{title}</h2>
    <p>This cloud-only dialog is not available in the self-host build.</p>
    <button type="button" onClick={() => setShowTrialModal(false)}>
      Close
    </button>
  </div>
);