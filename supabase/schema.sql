-- go-transfer-go: база данных для Supabase (бесплатный тариф).
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Файл можно запускать повторно: он ничего не удаляет из данных.
--
-- Как устроена регистрация и вход:
--   Регистрация: код из 6 цифр приходит на почту (Supabase Auth) → link_email() создаёт профиль →
--     человек подключает Telegram-бота и делится номером (функция tg-login, kind = 'link').
--   Вход: человек вписывает почту → бот присылает код из 6 цифр в Telegram (kind = 'login') →
--     код проверяет check_login_code(), и анонимная сессия браузера привязывается к профилю.
--   Вход через Google: Supabase сам подтверждает почту из Google, дальше тот же link_email().
--   Если Telegram у профиля подключён, войти одним кодом с почты или через Google нельзя: нужен код из Telegram.
--   public.me() возвращает профиль текущей сессии; на ней держатся все правила доступа (RLS).
-- Телефон и Telegram ID никогда не отдаются через API напрямую: на эти столбцы нет прав чтения.

-- ---------- Профили ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique,
  email text unique check (email is null or (char_length(email) <= 200 and email = lower(email))),
  phone text check (phone is null or phone ~ '^\+[0-9]{7,15}$'),
  phone_ok boolean not null default false,
  name text not null default '' check (char_length(name) <= 60),
  verified boolean not null default false,
  extra jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extra) = 'object' and pg_column_size(extra) < 120000),
  created_at timestamptz not null default now(),
  check (telegram_id is not null or email is not null)
);
-- Для баз, созданных первой версией этого файла
alter table public.profiles add column if not exists email text unique;
alter table public.profiles add column if not exists phone_ok boolean not null default false;
alter table public.profiles alter column telegram_id drop not null;
alter table public.profiles alter column phone drop not null;

-- Какие браузерные сессии принадлежат какому профилю
create table if not exists public.sessions (
  uid uuid primary key references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists sessions_profile_idx on public.sessions (profile_id);

-- Заявки: подключение Telegram (kind = 'link') и коды входа (kind = 'login').
-- Доступ только у функции tg-login (service role). Код входа хранится только как хэш.
create table if not exists public.login_requests (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  uid uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'link',
  profile_id uuid references public.profiles (id) on delete cascade,
  code text,
  code_hash text,
  attempts int not null default 0,
  ip_hash text,
  status text not null default 'new',
  telegram_id bigint,
  chat_id bigint,
  phone text,
  tg_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
-- Для баз, созданных прошлой версией этого файла
alter table public.login_requests add column if not exists kind text not null default 'link';
alter table public.login_requests add column if not exists profile_id uuid references public.profiles (id) on delete cascade;
alter table public.login_requests add column if not exists code_hash text;
alter table public.login_requests add column if not exists attempts int not null default 0;
alter table public.login_requests add column if not exists ip_hash text;
alter table public.login_requests alter column code drop not null;
alter table public.login_requests drop constraint if exists login_requests_status_check;
alter table public.login_requests drop constraint if exists login_requests_kind_check;
alter table public.login_requests add constraint login_requests_status_check
  check (status in ('new', 'wait', 'confirmed', 'denied', 'used', 'sent', 'failed', 'locked'));
alter table public.login_requests add constraint login_requests_kind_check check (kind in ('link', 'login'));
create index if not exists login_requests_uid_idx on public.login_requests (uid, created_at);
create index if not exists login_requests_tg_idx on public.login_requests (telegram_id, created_at);
create index if not exists login_requests_profile_idx on public.login_requests (profile_id, created_at);
create index if not exists login_requests_ip_idx on public.login_requests (ip_hash, created_at);

create or replace function public.me() returns uuid
language sql stable security definer set search_path = '' as $$
  select profile_id from public.sessions where uid = auth.uid()
$$;

-- Имя, которое видят другие: название компании или имя человека
create or replace function public.display_name(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when extra->>'ltype' = 'company' and coalesce(extra->>'cname', '') <> ''
              then left(extra->>'cname', 100) else name end
  from public.profiles where id = p
$$;

-- Ограничение частоты: не больше n записей за период от одного профиля
create or replace function public.too_many(tbl regclass, col text, who uuid, n int, period interval) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare c int;
begin
  execute format('select count(*) from (select 1 from %s where %I = $1 and created_at > now() - $2 limit $3) t', tbl, col)
    into c using who, period, n;
  return c >= n;
end $$;

-- ---------- Маршруты (объявления водителей) ----------
create or replace function public.valid_point(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p) = 'object'
     and jsonb_typeof(p->'lat') = 'number' and (p->>'lat')::float8 between -90 and 90
     and jsonb_typeof(p->'lon') = 'number' and (p->>'lon')::float8 between -180 and 180
     and char_length(coalesce(p->>'name', '')) between 1 and 120
$$;

create or replace function public.valid_caps(c jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(c) = 'object'
     and not exists (select 1 from jsonb_each(c) e
                     where e.key not in ('seat', 'parcel', 'car', 'drive')
                        or jsonb_typeof(e.value) <> 'number'
                        or (e.value::text)::numeric <> trunc((e.value::text)::numeric)
                        or (e.value::text)::numeric < 0
                        or (e.value::text)::numeric > case e.key when 'seat' then 60 when 'parcel' then 5000 when 'car' then 10 else 3 end)
$$;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.me() references public.profiles (id) on delete cascade,
  at timestamptz not null,
  caps jsonb not null check (public.valid_caps(caps)),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 8000
    and public.valid_point(data->'from') and public.valid_point(data->'to')),
  photo text check (photo is null or (char_length(photo) < 350000 and photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')),
  has_photo boolean generated always as (photo is not null) stored,
  created_at timestamptz not null default now()
);
create index if not exists routes_at_idx on public.routes (at);
create index if not exists routes_owner_idx on public.routes (owner);

-- ---------- Точки ожидания («ищу транспорт») ----------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.me() references public.profiles (id) on delete cascade,
  at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 3000
    and public.valid_point(data->'from') and public.valid_point(data->'to')
    and data->>'kind' in ('seat', 'parcel', 'car', 'drive')
    and jsonb_typeof(data->'people') = 'number' and (data->>'people')::numeric between 1 and 9
    and char_length(coalesce(data->>'note', '')) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists requests_at_idx on public.requests (at);

-- ---------- Брони ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes (id) on delete set null,
  passenger uuid not null references public.profiles (id) on delete cascade,
  driver uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('seat', 'parcel', 'car', 'drive')),
  qty int not null check (qty between 1 and 5000),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bookings_passenger_idx on public.bookings (passenger);
create index if not exists bookings_driver_idx on public.bookings (driver);

-- ---------- Чат ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null default public.me() references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  request_id uuid references public.requests (id) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index if not exists messages_sender_idx on public.messages (sender, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient, created_at);

-- ---------- Отзывы (только после брони, один на бронь) ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings (id) on delete set null,
  author uuid references public.profiles (id) on delete set null default public.me(),
  author_name text not null default '',
  target uuid references public.profiles (id) on delete cascade,
  target_name text not null default '',
  stars int not null check (stars between 1 and 5),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- Триггеры: сервер сам ставит владельца, имя и проверяет лимиты ----------
create or replace function public.tg_routes_ins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.owner := public.me();
  if new.owner is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  if new.at < now() - interval '1 hour' or new.at > now() + interval '366 days' then
    raise exception 'Проверьте дату выезда' using errcode = '22023'; end if;
  if public.too_many('public.routes', 'owner', new.owner, 20, interval '1 day') then
    raise exception 'Слишком много объявлений за сутки' using errcode = '54000'; end if;
  new.data := new.data || jsonb_build_object('driver', public.display_name(new.owner));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists routes_ins on public.routes;
create trigger routes_ins before insert on public.routes for each row execute function public.tg_routes_ins();

create or replace function public.tg_requests_ins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.owner := public.me();
  if new.owner is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  if new.at < now() - interval '1 day' or new.at > now() + interval '366 days' then
    raise exception 'Проверьте дату' using errcode = '22023'; end if;
  if public.too_many('public.requests', 'owner', new.owner, 20, interval '1 day') then
    raise exception 'Слишком много точек ожидания за сутки' using errcode = '54000'; end if;
  new.data := new.data || jsonb_build_object('name', public.display_name(new.owner));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists requests_ins on public.requests;
create trigger requests_ins before insert on public.requests for each row execute function public.tg_requests_ins();

create or replace function public.tg_messages_ins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.sender := public.me();
  if new.sender is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  if public.too_many('public.messages', 'sender', new.sender, 20, interval '1 minute')
     or public.too_many('public.messages', 'sender', new.sender, 500, interval '1 day') then
    raise exception 'Слишком много сообщений, подождите немного' using errcode = '54000'; end if;
  new.read_at := null;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists messages_ins on public.messages;
create trigger messages_ins before insert on public.messages for each row execute function public.tg_messages_ins();

create or replace function public.tg_reviews_ins() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  new.author := public.me();
  select * into b from public.bookings where id = new.booking_id;
  if new.author is null or b.id is null or b.passenger <> new.author then
    raise exception 'Отзыв можно оставить только после своей брони' using errcode = '42501'; end if;
  new.target := b.driver;
  new.target_name := coalesce(b.data->>'driver', public.display_name(b.driver));
  new.author_name := public.display_name(new.author);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists reviews_ins on public.reviews;
create trigger reviews_ins before insert on public.reviews for each row execute function public.tg_reviews_ins();

-- ---------- Действия, которые нельзя доверить браузеру ----------
-- Бронь: проверяет свободные места и уменьшает их в одной транзакции
create or replace function public.book_route(p_route uuid, p_kind text, p_qty int, p_info text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  who uuid := public.me();
  r public.routes;
  cap int;
  bid uuid;
  title text;
begin
  if who is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  if public.too_many('public.bookings', 'passenger', who, 30, interval '1 day') then
    raise exception 'Слишком много броней за сутки' using errcode = '54000'; end if;
  select * into r from public.routes where id = p_route for update;
  if r.id is null or r.at < now() - interval '1 hour' then raise exception 'Маршрут уже недоступен' using errcode = 'P0002'; end if;
  if r.owner = who then raise exception 'Это ваш маршрут' using errcode = '22023'; end if;
  cap := coalesce((r.caps->>p_kind)::int, 0);
  if p_qty is null or p_qty < 1 or p_qty > cap then raise exception 'Столько мест уже нет' using errcode = '22023'; end if;
  update public.routes set caps = jsonb_set(caps, array[p_kind], to_jsonb(cap - p_qty)) where id = r.id;
  title := left(coalesce(r.data->'from'->>'name', '') || ' → ' || coalesce(r.data->'to'->>'name', ''), 200);
  insert into public.bookings (route_id, passenger, driver, kind, qty, data)
  values (r.id, who, r.owner, p_kind, p_qty, jsonb_build_object(
    'title', title, 'at', r.at, 'driver', r.data->>'driver', 'passenger', public.display_name(who),
    'cost', coalesce((r.data->'prices'->>p_kind)::numeric, 0) * p_qty, 'info', left(coalesce(p_info, ''), 200)))
  returning id into bid;
  insert into public.messages (sender, recipient, route_id, title, body)
  values (who, r.owner, r.id, title, left('Новая бронь. ' || case p_kind when 'seat' then 'Мест' when 'parcel' then 'Посылка, кг' when 'car' then 'Машин на трале' else 'Машин на перегон' end
    || ': ' || p_qty || case when coalesce(p_info, '') <> '' then '. ' || p_info else '' end, 1000));
  return bid;
end $$;

-- Телефон второй стороны брони: пассажир видит телефон водителя, водитель телефон пассажира
create or replace function public.booking_phone(p_booking uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.phone from public.bookings b
  join public.profiles p on p.id = case when b.passenger = public.me() then b.driver else b.passenger end
  where b.id = p_booking and public.me() in (b.passenger, b.driver)
$$;

-- Свой профиль целиком (с телефоном и почтой) — только для себя
create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'phone_ok', phone_ok, 'email', email,
    'telegram', telegram_id is not null, 'verified', verified, 'extra', extra)
  from public.profiles where id = public.me()
$$;

-- Вход по почте: после того как Supabase проверил код из письма, привязываем сессию к профилю
create or replace function public.link_email() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare em text; pid uuid;
begin
  select lower(email) into em from auth.users
  where id = auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous, false);
  if em is null then raise exception 'Почта не подтверждена' using errcode = '42501'; end if;
  select id into pid from public.profiles where email = em;
  if pid is null then
    insert into public.profiles (email) values (em) returning id into pid;
  elsif exists (select 1 from public.profiles where id = pid and telegram_id is not null) then
    -- Telegram подключён: одного кода с почты мало, вход только с кодом из Telegram
    raise exception 'У этого аккаунта подключён Telegram. Войдите с кодом, который придёт в Telegram' using errcode = '42501';
  end if;
  insert into public.sessions (uid, profile_id) values (auth.uid(), pid)
    on conflict (uid) do update set profile_id = excluded.profile_id;
  return public.my_profile();
end $$;

-- Проверка кода входа из Telegram. Вызывает только функция tg-login (service role).
-- Всё в одной транзакции: не больше 5 попыток на код, код одноразовый, живёт 5 минут.
create or replace function public.check_login_code(p_token_hash text, p_uid uuid, p_code_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.login_requests;
begin
  select * into r from public.login_requests
  where token_hash = p_token_hash and uid = p_uid and kind = 'login' for update;
  if r.id is null then return jsonb_build_object('status', 'bad'); end if;
  if r.status = 'denied' then return jsonb_build_object('status', 'denied'); end if;
  if r.status <> 'sent' or r.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  if r.attempts >= 5 then
    update public.login_requests set status = 'locked' where id = r.id;
    return jsonb_build_object('status', 'locked');
  end if;
  if r.code_hash is distinct from p_code_hash then
    update public.login_requests set attempts = attempts + 1,
      status = case when attempts + 1 >= 5 then 'locked' else status end where id = r.id;
    return jsonb_build_object('status', case when r.attempts + 1 >= 5 then 'locked' else 'bad' end);
  end if;
  update public.login_requests set status = 'used' where id = r.id;
  -- Все прочие коды этого профиля больше не действуют
  update public.login_requests set status = 'used' where profile_id = r.profile_id and kind = 'login' and status = 'sent';
  insert into public.sessions (uid, profile_id) values (p_uid, r.profile_id)
    on conflict (uid) do update set profile_id = excluded.profile_id;
  return jsonb_build_object('status', 'ok', 'telegram_id', r.telegram_id);
end $$;

-- Номер телефона для тех, кто вошёл по почте (номер не проверен, это видно другим).
-- Подтверждённый через Telegram номер изменить нельзя.
create or replace function public.set_phone(p text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := '+' || regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if public.me() is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  if v !~ '^\+[0-9]{7,15}$' then raise exception 'Проверьте номер' using errcode = '22023'; end if;
  update public.profiles set phone = v where id = public.me() and not phone_ok;
end $$;

-- Удалить аккаунт и все свои данные (GDPR, закон РМ 133/2011)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare who uuid := public.me();
begin
  if who is null then raise exception 'Нужно войти' using errcode = '42501'; end if;
  delete from auth.users where id in (select uid from public.sessions where profile_id = who);
  delete from public.profiles where id = who;
end $$;

-- ---------- Права доступа ----------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.login_requests enable row level security;
alter table public.routes enable row level security;
alter table public.requests enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

revoke all on public.profiles, public.sessions, public.login_requests, public.routes, public.requests,
  public.bookings, public.messages, public.reviews from anon, authenticated;
-- Supabase по умолчанию разрешает новые функции ролям anon и authenticated: закрываем всё и открываем только нужное
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Читать объявления, профили и отзывы могут только вошедшие люди (не пустые анонимные сессии)
-- Профили: имя, значок проверки и публичные поля; телефон, почту и Telegram ID не видит никто
grant select (id, name, verified, phone_ok, extra, created_at) on public.profiles to authenticated;
grant update (name, extra) on public.profiles to authenticated;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (public.me() is not null);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = public.me()) with check (id = public.me());

grant select, delete on public.sessions to authenticated;
drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for select to authenticated using (uid = auth.uid());
drop policy if exists sessions_logout on public.sessions;
create policy sessions_logout on public.sessions for delete to authenticated using (uid = auth.uid());

grant select (id, owner, at, caps, data, has_photo, created_at), insert (at, caps, data, photo), delete on public.routes to authenticated;
grant select (id, photo) on public.routes to authenticated;
drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes for select to authenticated using (public.me() is not null);
drop policy if exists routes_add on public.routes;
create policy routes_add on public.routes for insert to authenticated with check (owner = public.me());
drop policy if exists routes_del on public.routes;
create policy routes_del on public.routes for delete to authenticated using (owner = public.me());

grant select (id, owner, at, data, created_at), insert (at, data), delete on public.requests to authenticated;
drop policy if exists requests_read on public.requests;
create policy requests_read on public.requests for select to authenticated using (public.me() is not null);
drop policy if exists requests_add on public.requests;
create policy requests_add on public.requests for insert to authenticated with check (owner = public.me());
drop policy if exists requests_del on public.requests;
create policy requests_del on public.requests for delete to authenticated using (owner = public.me());

grant select on public.bookings to authenticated;
drop policy if exists bookings_parties on public.bookings;
create policy bookings_parties on public.bookings for select to authenticated using (public.me() in (passenger, driver));

grant select, insert (recipient, route_id, request_id, title, body), update (read_at) on public.messages to authenticated;
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (public.me() in (sender, recipient));
drop policy if exists messages_add on public.messages;
create policy messages_add on public.messages for insert to authenticated with check (sender = public.me());
drop policy if exists messages_seen on public.messages;
create policy messages_seen on public.messages for update to authenticated using (recipient = public.me()) with check (recipient = public.me());

grant select (id, booking_id, author_name, target, target_name, stars, body, created_at), insert (booking_id, stars, body) on public.reviews to authenticated;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (public.me() is not null);
drop policy if exists reviews_add on public.reviews;
create policy reviews_add on public.reviews for insert to authenticated with check (author = public.me());

grant execute on function public.me(), public.book_route(uuid, text, int, text), public.booking_phone(uuid),
  public.delete_my_account(), public.my_profile(), public.link_email(), public.set_phone(text),
  public.valid_point(jsonb), public.valid_caps(jsonb) to authenticated;
revoke execute on function public.check_login_code(text, uuid, text) from authenticated;
grant execute on function public.check_login_code(text, uuid, text) to service_role;
