
import { DashOrca } from "../componets/dashboards/dashboard-orca";



export function Dash() {
  return (
    <div className="relative min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      <DashOrca />
    </div>
  );
}

