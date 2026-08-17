import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About BBM — Household Store in Juba" },
      {
        name: "description",
        content: "BBM is a family-run household store in Munuki, Block B, Juba.",
      },
      { property: "og:title", content: "About BBM" },
      { property: "og:description", content: "A family-run household store serving Juba." },
    ],
  }),
});

function About() {
  const { t } = useI18n();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold sm:text-5xl">{t("about.title")}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{t("about.body")}</p>
      </section>
    </Layout>
  );
}
