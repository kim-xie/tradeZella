import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function BrokenComponent(): React.ReactElement {
  throw new Error('Test crash in component');
}

describe('ErrorBoundary', () => {
  it('catches render error and displays fallback UI instead of crashing', () => {
    // Suppress console.error in test output for intentional error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Custom Fallback Title">
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback Title')).toBeInTheDocument();
    expect(screen.getByText(/Test crash in component/)).toBeInTheDocument();

    spy.mockRestore();
  });
});
