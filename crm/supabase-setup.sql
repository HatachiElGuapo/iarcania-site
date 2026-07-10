-- =============================================================
-- IArcanIA CRM — Supabase Setup
-- Ejecutar en: https://gpfidxxawcwsbuzsbeob.supabase.co
-- SQL Editor → New query → Run
-- =============================================================

-- 1. EXTENDER clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS source text;

-- 2. EXTENDER projects (pipeline/deals)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'contacted',
  ADD COLUMN IF NOT EXISTS anticipo_pct numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS anticipo_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS closed_at timestamp,
  ADD COLUMN IF NOT EXISTS service_type text;

-- 3. EXTENDER budgets (categorías de presupuesto)
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';

-- 4. EXTENDER income (vincular a cliente/proyecto + marcar distribución)
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS distribution_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS project_id text;

-- 5. CREAR budget_distributions (nueva tabla)
CREATE TABLE IF NOT EXISTS budget_distributions (
  id           text PRIMARY KEY,
  income_id    text REFERENCES income(id) ON DELETE CASCADE,
  budget_id    text REFERENCES budgets(id),
  amount_assigned numeric NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE budget_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON budget_distributions
  FOR ALL USING (
    income_id IN (SELECT id FROM income WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

-- 6. CREAR debts (deudas grandes)
CREATE TABLE IF NOT EXISTS debts (
  id               text PRIMARY KEY,
  user_id          text NOT NULL,
  creditor         text NOT NULL,
  debtor           text NOT NULL,         -- 'miguel' | 'diana' | 'hogar'
  total_amount     numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  monthly_payment  numeric,
  due_date         date,
  status           text DEFAULT 'active', -- 'active' | 'paid'
  notes            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON debts
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =============================================================
-- POBLAR budgets CON EL PRESUPUESTO REAL DE MIGUEL
-- Ajusta user_id si no es 'u1'
-- =============================================================
INSERT INTO budgets (id, user_id, name, type, amount, priority, is_active, month, year)
VALUES
  ('b_mercado',     'u1', 'Mercado',                 'expense', 1200000, 1,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_servicios',   'u1', 'Hogar/Servicios',         'expense',  374000, 2,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_admin',       'u1', 'Admin Edificio',           'expense',  150000, 3,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_morado',      'u1', 'Morado',                   'expense',   50000, 4,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_cuota_jeiss', 'u1', 'Cuota deuda Miguel-Jeiss','expense',  310000, 5,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_sitp',        'u1', 'SITP Diana',               'expense',  200000, 6,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_herram',      'u1', 'Herramientas trabajo',     'expense',  100000, 7,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_miguel',      'u1', 'Gasto personal Miguel',    'expense',  100000, 8,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_diana',       'u1', 'Gasto personal Diana',     'expense',  150000, 9,  true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now())),
  ('b_hogar_var',   'u1', 'Hogar varios',             'expense',  100000, 10, true, EXTRACT(MONTH FROM now()), EXTRACT(YEAR FROM now()))
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- POBLAR debts CON DEUDAS ACTUALES
-- =============================================================
INSERT INTO debts (id, user_id, creditor, debtor, total_amount, remaining_amount, monthly_payment, due_date, notes)
VALUES
  ('debt_jeisson', 'u1', 'Jeisson',  'miguel', 2000000, 2000000, 310000, NULL,         'Cuota mensual $310k'),
  ('debt_jenny',   'u1', 'Jenny',    'diana',  4000000, 4000000, NULL,   NULL,         'Sin cuota fija definida'),
  ('debt_serv',    'u1', 'Servicios','hogar',   724000,  724000, NULL,   CURRENT_DATE + INTERVAL '7 days', 'Servicios atrasados, vence en 7 días'),
  ('debt_admin',   'u1', 'Admin',    'hogar',   200000,  200000, NULL,   NULL,         'Admin edificio atrasada')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- VERIFICACIÓN FINAL
-- =============================================================
SELECT 'clients columns' as check, column_name FROM information_schema.columns WHERE table_name='clients' AND column_name IN ('status','source');
SELECT 'projects columns' as check, column_name FROM information_schema.columns WHERE table_name='projects' AND column_name IN ('stage','service_type','anticipo_pct');
SELECT 'budgets count' as check, count(*) FROM budgets WHERE user_id='u1';
SELECT 'debts count' as check, count(*) FROM debts WHERE user_id='u1';
