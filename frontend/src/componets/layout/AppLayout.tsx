import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidbars/sidebar';

export function AppLayout() {
  return (
    <>
      <Sidebar />
      <Outlet />
    </>
  );
}
