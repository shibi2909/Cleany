import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicData } from "@/lib/data/catalog";

export const revalidate = 300;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getPublicData();
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
