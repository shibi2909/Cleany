import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSessionUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/customer/dashboard");
  return (
    <>
      <h1 className="display text-3xl">Create your account</h1>
      <p className="mb-8 mt-2 text-muted">Book in minutes and track every step of your cleaning.</p>
      <SignupForm next={next} />
    </>
  );
}
