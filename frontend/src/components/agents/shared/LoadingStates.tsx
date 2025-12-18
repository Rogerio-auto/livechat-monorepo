// frontend/src/components/agents/shared/LoadingStates.tsx
export function LoadingCard() {
  return (
    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}
