import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetaFlowsManager from './MetaFlowsManager';
import * as api from '../../../utils/api';

// Mock fetchJson
vi.mock('../../../utils/api', () => ({
  fetchJson: vi.fn(),
  API: 'http://localhost:5000'
}));

describe('MetaFlowsManager Component', () => {
  const mockInboxId = '12345';
  const mockFlows = {
    data: [
      { id: '1', meta_flow_id: 'flow1', name: 'Flow 1', status: 'PUBLISHED', categories: ['OTHER'] },
      { id: '2', meta_flow_id: 'flow2', name: 'Flow 2', status: 'DRAFT', categories: ['OTHER'] }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component and fetch flows on mount', async () => {
    (api.fetchJson as any).mockResolvedValue(mockFlows);

    render(<MetaFlowsManager inboxId={mockInboxId} />);

    expect(screen.getByText(/Meta Flows \(Formulários\)/i)).toBeDefined();
    
    await waitFor(() => {
      expect(api.fetchJson).toHaveBeenCalledWith(expect.stringContaining(`/api/meta/flows/${mockInboxId}`));
    });

    await waitFor(() => {
      expect(screen.getByText('Flow 1')).toBeDefined();
      expect(screen.getByText('Flow 2')).toBeDefined();
    });
  });

  it('should handle synchronization', async () => {
    (api.fetchJson as any)
      .mockResolvedValueOnce(mockFlows) // initial fetch
      .mockResolvedValueOnce({ success: true }) // sync
      .mockResolvedValueOnce(mockFlows); // re-fetch

    render(<MetaFlowsManager inboxId={mockInboxId} />);

    await waitFor(() => screen.getByText('Sincronizar'));
    
    const syncButton = screen.getByText('Sincronizar');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.fetchJson).toHaveBeenCalledWith(
        expect.stringContaining(`/api/meta/flows/${mockInboxId}/sync`),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('should display empty state when no flows are found', async () => {
    (api.fetchJson as any).mockResolvedValue({ data: [] });

    render(<MetaFlowsManager inboxId={mockInboxId} />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum formulário sincronizado/i)).toBeDefined();
    });
  });
});
