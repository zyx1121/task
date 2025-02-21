"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="h-dvh flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Task Board</h1>
        <Button onClick={signInWithGoogle}>Login with Google</Button>
      </div>
    </div>
  );
}
