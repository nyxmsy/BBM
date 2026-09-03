import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  MapPin,
  Phone,
  UtensilsCrossed,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { useI18n, bilingual } from "@/lib/i18n";
import { CATEGORIES, type Product } from "@/lib/products";
import { useCatalog } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { WhatsAppIcon, whatsappHref } from "@/components/WhatsAppIcon";
import { STORE } from "@/lib/store";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BBM — Household Store · Juba, South Sudan" },
      {
        name: "description",
        content:
          "Kitchenware, bags, shoes, oils and essentials delivered across Juba. Cash on delivery, M-Pesa, or store pickup.",
      },
      { property: "og:title", content: "BBM — Household Store · Juba" },
      {
        property: "og:description",
        content: "Order household essentials in Juba. Pay on delivery.",
      },
    ],
  }),
});

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 md:py-16 lg:py-24">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" /> {t("hero.eyebrow")}
          </span>
          <h1 className="mt-5 text-4xl leading-[1.05] font-bold text-foreground sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.98]"
            >
              {t("hero.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
            <Link
              to="/categories"
              className="btn-tap inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground transition hover:bg-secondary"
            >
              {t("hero.cta2")}
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/5] overflow-hidden rounded-[2rem] shadow-xl md:aspect-[5/6]">
            <img
              src={heroImg}
              alt="Curated household goods"
              width={1600}
              height={1200}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-4 -start-4 hidden rounded-2xl bg-card p-4 shadow-lg sm:block">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <div className="text-sm">
                <div className="font-semibold">{t("why.delivery")}</div>
                <div className="text-muted-foreground">{t("why.deliveryD")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoriesRow() {
  const { t, lang } = useI18n();
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("home.categories")}</h2>
        <Link to="/categories" className="text-sm font-medium text-primary hover:underline">
          {t("nav.categories")} →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {CATEGORIES.slice(0, 8).map((c) => (
          <Link
            key={c.slug}
            to="/shop"
            search={{ cat: c.slug } as never}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ background: c.tint }}
              aria-hidden
            >
              <CategoryIcon slug={c.slug} className="h-7 w-7 text-foreground/80" />
            </div>
            <div className="text-sm font-semibold">{bilingual(c.name, lang)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductRow({ title, items }: { title: string; items: Product[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <Link to="/shop" className="text-sm font-medium text-primary hover:underline">
          →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.slice(0, 8).map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

function Promo() {
  const { t, lang } = useI18n();
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-12 sm:py-14">
        <div className="max-w-lg">
          <div className="text-sm/6 uppercase tracking-wider opacity-80">{t("home.offers")}</div>
          <h3 className="mt-2 text-3xl font-bold sm:text-4xl">
            {lang === "ar" ? "خصم 20% على أطقم المطبخ" : "20% off kitchen sets"}
          </h3>
          <p className="mt-3 opacity-90">
            {lang === "ar"
              ? "لفترة محدودة. توصيل في نفس اليوم داخل جوبا."
              : "Limited time. Same-day delivery across Juba."}
          </p>
          <Link
            to="/shop"
            search={{ cat: "kitchen" } as never}
            className="btn-tap mt-6 inline-flex items-center gap-2 rounded-full bg-background px-6 text-base font-semibold text-foreground"
          >
            {t("hero.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
        </div>
        <div className="pointer-events-none absolute -end-6 -top-6 opacity-20">
          <UtensilsCrossed className="h-64 w-64" strokeWidth={1} />
        </div>
      </div>
    </section>
  );
}

function Why() {
  const { t } = useI18n();
  const items = [
    { icon: ShieldCheck, k: "quality" },
    { icon: Sparkles, k: "price" },
    { icon: Store, k: "trust" },
    { icon: Truck, k: "delivery" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("home.why")}</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map(({ icon: Icon, k }) => (
          <div key={k} className="rounded-2xl border border-border/60 bg-card p-5 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/40 text-foreground">
              <Icon className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold">{t(`why.${k}`)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t(`why.${k}D`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const { t, lang } = useI18n();
  const items =
    lang === "ar"
      ? [
          { n: "أمل م.", q: "خدمة سريعة وتوصيل ممتاز. أطباق جميلة!" },
          { n: "جون د.", q: "أسعار عادلة والجودة عالية. أنصح به." },
          { n: "ماري أ.", q: "طلبت زيت جوز الهند ووصل نفس اليوم. رائع." },
        ]
      : [
          { n: "Amel M.", q: "Fast service and great delivery. Beautiful dishes!" },
          { n: "John D.", q: "Fair prices and quality is excellent. Highly recommend." },
          { n: "Mary A.", q: "Ordered coconut oil and it arrived the same day. Amazing." },
        ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("home.testimonials")}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((r) => (
          <figure key={r.n} className="rounded-2xl border border-border/60 bg-card p-6">
            <blockquote className="text-base leading-relaxed">“{r.q}”</blockquote>
            <figcaption className="mt-4 text-sm font-medium text-muted-foreground">
              — {r.n}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Visit() {
  const { t, lang } = useI18n();
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid gap-8 rounded-3xl bg-secondary/50 p-6 sm:p-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home.visit")}</h2>
          <p className="mt-3 text-muted-foreground">
            {lang === "ar"
              ? "نحن هنا لخدمتك. تفضل بزيارة متجرنا في منوكي، بلوك ب، جوبا."
              : "Come and visit us in Munuki, Block B, Juba. We'd love to see you."}
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />{" "}
              {lang === "ar" ? STORE.address.ar : STORE.address.en}
            </li>
            <li className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" /> {STORE.phonePrimary}
            </li>
            <li>
              <a
                href={whatsappHref(STORE.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-primary"
              >
                <WhatsAppIcon className="h-5 w-5 text-[#25D366]" /> {STORE.whatsapp}
              </a>
            </li>
          </ul>
          <Link
            to="/contact"
            className="btn-tap mt-6 inline-flex items-center rounded-full bg-foreground px-6 text-sm font-semibold text-background"
          >
            {t("home.contact")}
          </Link>
        </div>
        <div className="grid place-items-center rounded-2xl bg-card p-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-2xl bg-accent/50 text-foreground">
            <Store className="h-10 w-10" />
          </div>
          <div className="mt-4 font-display text-xl font-semibold">BBM Household</div>
          <div className="text-sm text-muted-foreground">
            {lang === "ar" ? STORE.hours.ar : STORE.hours.en}
          </div>
        </div>
      </div>
    </section>
  );
}

function Index() {
  const { t } = useI18n();
  const { products } = useCatalog();
  const featured = products.filter((p) => p.featured);
  const newer = products.filter((p) => p.newArrival);
  return (
    <Layout>
      <Hero />
      <CategoriesRow />
      <ProductRow title={t("home.featured")} items={featured} />
      <Promo />
      <ProductRow title={t("home.new")} items={newer} />
      <Why />
      <Testimonials />
      <Visit />
    </Layout>
  );
}
