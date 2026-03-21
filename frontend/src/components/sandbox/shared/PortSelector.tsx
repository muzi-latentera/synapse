import { memo } from 'react';
import type { PortInfo } from '@/types/sandbox.types';
import { Select } from '@/components/ui/primitives/Select';

export interface PortSelectorProps {
  ports: PortInfo[];
  selectedPort: PortInfo | null;
  onPortChange: (port: PortInfo) => void;
}

export const PortSelector = memo(function PortSelector({
  ports,
  selectedPort,
  onPortChange,
}: PortSelectorProps) {
  if (ports.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">Port</span>
      <Select
        value={selectedPort?.port?.toString() ?? ''}
        onChange={(e) => {
          const port = ports.find((p) => p.port === Number(e.target.value));
          if (port) onPortChange(port);
        }}
        className="h-6 border-border/30 bg-transparent text-2xs dark:border-border-dark/30"
      >
        {ports.map((port) => (
          <option key={port.port} value={port.port}>
            {port.port}
          </option>
        ))}
      </Select>
    </div>
  );
});
