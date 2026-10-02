"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleButton } from "@/components/auth/google-button";
import { authPost } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";

type AuthMode = "create" | "login";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: async () => {
      const response = await authPost("login", { email, password });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "login failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.push("/library");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.add({ title: "Login failed", description: error.message, type: "error" });
    },
  });

  const register = useMutation({
    mutationFn: async () => {
      const response = await authPost("register", { email, password });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "registration failed");
      }
      const loginResponse = await authPost("login", { email, password });
      if (!loginResponse.ok) {
        throw new Error("account created — please log in");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.push("/library");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.add({ title: "Registration failed", description: error.message, type: "error" });
    },
  });

  const busy = login.isPending || register.isPending;
  const isCreate = mode === "create";

  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-5xl lg:text-6xl font-bold tracking-tighter leading-[0.95] text-foreground">
          {isCreate ? "Create Account" : "Welcome back"}
        </h1>
        <p className="text-muted-foreground">
          {isCreate ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setMode(isCreate ? "login" : "create")}
            aria-label={isCreate ? "Switch to log in" : "Switch to sign up"}
            className="font-medium text-[--status-active] hover:underline decoration-[--status-active]/40 underline-offset-4 transition-colors"
          >
            {isCreate ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>

      {/* Google sign-in */}
      <GoogleButton />

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border/70" />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Or
        </span>
        <div className="flex-1 h-px bg-border/70" />
      </div>

      {/* Email */}
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email address"
        className="w-full px-4 py-3 bg-[oklch(0.92_0.014_86)] border border-border text-[oklch(0.180_0.010_80.6)] placeholder:text-muted-foreground/70 outline-none focus:border-[--status-active]/60 transition-colors"
      />

      {/* Password */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 pr-12 bg-[oklch(0.92_0.014_86)] border border-border text-[oklch(0.180_0.010_80.6)] placeholder:text-muted-foreground/70 outline-none focus:border-[--status-active]/60 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Primary action — Create Account or Log in */}
      <button
        className="w-full py-3.5 bg-foreground text-background font-serif text-lg font-bold tracking-tight rounded-none shadow-sm hover:-translate-y-0.5 hover:shadow-lg hover:bg-foreground/85 active:translate-y-0 active:shadow-none transition-all duration-150 disabled:opacity-50"
        disabled={busy || !email || (isCreate ? !password : password.length < 8)}
        onClick={() => (isCreate ? register.mutate() : login.mutate())}
      >
        {isCreate ? "Create Account" : "Log in"}
      </button>
      <p className="text-xs text-muted-foreground leading-relaxed">
        By continuing, I agree with TrakPlus&apos;s{" "}
        <span className="text-[--status-active] hover:underline underline-offset-4">
          Privacy Policy
        </span>{" "}
        and{" "}
        <span className="text-[--status-active] hover:underline underline-offset-4">
          Terms of Service
        </span>
        .
      </p>
    </div>
  );
}
