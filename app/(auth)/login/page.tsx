import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

const NOTICES: Record<string, string> = {
  confirmation: "That confirmation link is invalid or has expired. Please log in or sign up again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : user.profile.role === "admin" ? "/admin/dashboard" : "/customer/dashboard");

  return (
    <>
      <h1 className="display text-3xl">Welcome back</h1>
      <p className="mb-8 mt-2 text-muted">Log in to book, pay and manage your cleanings.</p>
      <LoginForm next={next} notice={error ? NOTICES[error] : undefined} />
    </>
  );
}
