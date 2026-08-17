CREATE TYPE public.app_role AS ENUM ('admin','staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  desc_en text NOT NULL DEFAULT '',
  desc_ar text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  compare_at integer,
  category text NOT NULL,
  emoji text NOT NULL DEFAULT '📦',
  tint text NOT NULL DEFAULT 'oklch(0.92 0.03 75)',
  image_url text,
  stock integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  best_seller boolean NOT NULL DEFAULT false,
  new_arrival boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view active products" ON public.products FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  phone text NOT NULL,
  phone2 text,
  address text,
  area text,
  city text NOT NULL DEFAULT 'Juba',
  notes text,
  payment_method text NOT NULL DEFAULT 'cod',
  mpesa_txid text,
  subtotal integer NOT NULL DEFAULT 0,
  delivery_fee integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  line_total integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

INSERT INTO public.products (slug,name_en,name_ar,desc_en,desc_ar,price,compare_at,category,emoji,tint,stock,featured,best_seller,new_arrival,sort_order) VALUES
('ceramic-dinner-set-24','Ceramic Dinner Set — 24 pieces','طقم عشاء سيراميك — 24 قطعة','Elegant 24-piece ceramic dinner set for six. Chip-resistant and dishwasher safe. Perfect for family gatherings.','طقم عشاء سيراميك أنيق مكوّن من 24 قطعة يكفي لستة أشخاص. مقاوم للكسر وآمن للغسالة. مثالي لتجمعات العائلة.',85000,105000,'kitchen','🍽️','oklch(0.94 0.03 75)',12,true,true,false,0),
('non-stick-pan-28','Non-Stick Frying Pan 28cm','مقلاة غير لاصقة 28 سم','Heavy-base non-stick frying pan with soft-touch handle. Even heat, easy to clean.','مقلاة قاعدة سميكة بطبقة غير لاصقة ومقبض مريح. توزيع حرارة ممتاز وسهلة التنظيف.',28000,NULL,'cookware','🍳','oklch(0.9 0.05 45)',20,true,false,true,1),
('cast-iron-pot-5l','Cast Iron Cooking Pot — 5L','قدر حديد للطبخ — 5 لتر','Durable 5-litre cast iron pot for stews, soups and everyday cooking.','قدر حديد متين سعة 5 لتر للحساء والطبخ اليومي.',65000,NULL,'cookware','🥘','oklch(0.85 0.04 40)',8,true,false,false,2),
('leather-tote-bag','Everyday Leather Tote','حقيبة يد جلدية يومية','Spacious tote in soft brown leather. Roomy for shopping and everyday use.','حقيبة واسعة من الجلد البني الناعم مناسبة للتسوق والاستخدام اليومي.',42000,NULL,'bags','👜','oklch(0.86 0.06 35)',15,true,true,false,3),
('school-backpack','Student Backpack','حقيبة ظهر للطلاب','Sturdy backpack with padded straps and laptop sleeve.','حقيبة ظهر متينة بأحزمة مبطنة وجيب للكمبيوتر المحمول.',22000,NULL,'bags','🎒','oklch(0.88 0.05 240)',30,false,false,true,4),
('womens-sandals','Women''s Comfort Sandals','صندل نسائي مريح','Soft footbed sandals designed for all-day comfort.','صندل بنعل ناعم للراحة طوال اليوم.',18000,NULL,'shoes','👡','oklch(0.9 0.05 30)',22,false,false,false,5),
('mens-loafers','Men''s Everyday Loafers','حذاء رجالي يومي','Classic slip-on loafers in brown leather.','حذاء كلاسيكي بدون رباط من الجلد البني.',35000,NULL,'shoes','👞','oklch(0.82 0.05 40)',14,false,true,false,6),
('coconut-body-oil-250','Pure Coconut Body Oil — 250ml','زيت جوز الهند للجسم — 250 مل','Cold-pressed coconut oil for skin and hair. 100% natural.','زيت جوز الهند المعصور على البارد للبشرة والشعر. طبيعي 100%.',6500,NULL,'oils','🥥','oklch(0.94 0.03 100)',60,true,false,false,7),
('shea-lotion-400','Shea Butter Lotion — 400ml','لوشن زبدة الشيا — 400 مل','Deep-moisturising shea butter body lotion for daily use.','لوشن زبدة الشيا المرطب بعمق للاستخدام اليومي.',8500,NULL,'lotions','🧴','oklch(0.94 0.04 90)',40,false,true,true,8),
('multi-surface-cleaner','Multi-Surface Cleaner — 1L','منظف متعدد الأسطح — 1 لتر','Powerful, gentle-scent cleaner for kitchens and bathrooms.','منظف قوي برائحة لطيفة للمطابخ والحمامات.',4500,NULL,'cleaning','🧴','oklch(0.93 0.04 200)',80,false,false,false,9),
('storage-basket-set','Woven Storage Basket Set — 3','طقم سلال تخزين مضفرة — 3','Set of three hand-woven storage baskets. Great for laundry and organising.','ثلاث سلال مضفرة يدويًا. مثالية للغسيل والتنظيم.',32000,NULL,'household','🧺','oklch(0.9 0.05 70)',10,true,false,true,10),
('stainless-flask-1l','Stainless Steel Flask — 1L','ترمس ستانلس ستيل — 1 لتر','Keeps drinks hot for 12 hours and cold for 24. Leak-proof.','يحافظ على السخونة 12 ساعة والبرودة 24 ساعة. لا يسرّب.',15000,NULL,'household','🫙','oklch(0.9 0.02 220)',0,false,false,false,11);