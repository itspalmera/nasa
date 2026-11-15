// frontend/src/components/step3-predictor/CopilotChatPanel.tsx
'use client';

import {useT} from '../../i18n/useT';
import React from 'react';
import { RagCopilotWorkspace } from '../../components/copilot/RagCopilotWorkspace';

export const CopilotChatPanel: React.FC = () => {
  const t = useT();

  return <RagCopilotWorkspace variant="embedded" />;
};