"use client";

import LoginPage from "@/components/login-page";
import TaskBoard from "@/components/task-board";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <LoginPage />;
  }

  if (!loading && user) {
    return <TaskBoard />;
  }

  return (
    <main className="h-dvh flex items-center justify-center">
      <div className="text-xl">Loading...</div>
    </main>
  );
}
