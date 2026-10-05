import Link from "next/link";
import { LogOut, Plus, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { CustomerNav } from "@/components/customer/customer-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getPublicData } from "@/lib/data/catalog";
import { BRAND } from "@/lib/config/brand";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { settings } = await getPublicData();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link href="/" aria-label={`${BRAND.name} home`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            {user.profile.role === "admin" ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/dashboard">
                  <ShieldCheck aria-hidden /> Admin
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/book">
                <Plus aria-hidden /> Book a cleaning
              </Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" size="sm" variant="ghost" aria-label="Log out">
                <LogOut aria-hidden /> <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="container-page pb-3">
          <CustomerNav />
        </div>
      </header>
      <main id="main" className="container-page py-8 sm:py-10">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
