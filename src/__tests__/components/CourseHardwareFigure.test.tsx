import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExperimentGuide from '@/components/simulation/ExperimentGuide';
import { getExperimentConfig } from '@/lib/experiment-config';

jest.mock('lucide-react', () => {
  const ReactLib = require('react');
  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      const Icon = (props: React.SVGProps<SVGSVGElement>) => ReactLib.createElement('svg', props);
      Icon.displayName = String(prop);
      return Icon;
    },
  });
});

describe('ExperimentGuide hardware figures', () => {
  it('inlines the course schematic at its drawn width instead of scaling a bitmap', () => {
    render(<ExperimentGuide experiment={getExperimentConfig('exp01') ?? null} />);

    expect(screen.getByText('80C51 / AT89C51 引脚示意')).toBeInTheDocument();
    expect(screen.getAllByText('2kΩ').length).toBeGreaterThan(0);
    expect(document.querySelector('img')).toBeNull();
    const drawn = document.querySelector('figure svg');
    expect(drawn).not.toBeNull();
    expect(drawn?.getAttribute('viewBox')).toContain('0 0 760');
    expect(screen.getAllByRole('button', { name: '放大查看' }).length).toBeGreaterThan(0);
  });
});
