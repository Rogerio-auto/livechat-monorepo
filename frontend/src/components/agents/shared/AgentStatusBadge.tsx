// frontend/src/components/agents/shared/AgentStatusBadge.tsx
export function AgentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    ERROR: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || colors.INACTIVE}`}>
      {status}
    </span>
  );
}
