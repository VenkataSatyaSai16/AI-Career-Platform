import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] md:grid-cols-[280px_1fr]">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex min-h-screen flex-col">
          <div className="md:hidden">
            <Sidebar />
          </div>
          <Navbar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
