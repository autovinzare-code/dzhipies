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

-- Админы приложения: почта профиля. Добавить себя: insert into public.admins (email) values ('ваша@почта');
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

-- Админ: вошедший человек, чья почта есть в таблице admins
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join public.admins a on a.email = p.email where p.id = public.me())
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
    'telegram', telegram_id is not null, 'verified', verified, 'extra', extra, 'is_admin', public.is_admin())
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

-- ---------- История действий для админки ----------
-- Что записываем: какой экран открыт, на какую кнопку нажали, выбранный город в поиске, подача объявления,
--   бронь, вход и выход. Только если человек сам разрешил это в приложении.
-- Что НЕ записываем никогда: пароли, коды входа, текст сообщений и отзывов, то, что человек печатает.
-- Читать историю может только админ (таблица admins). Старые записи удаляются сами (по умолчанию через 12 месяцев).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('events_retention_months', '12') on conflict (key) do nothing;

create table if not exists public.events (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete cascade,
  uid uuid references auth.users (id) on delete cascade,
  sid text check (char_length(sid) <= 40),
  device text check (char_length(device) <= 20),
  name text not null check (name ~ '^[a-z_]{1,32}$'),
  screen text check (char_length(screen) <= 60),
  target text check (char_length(target) <= 80),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 1200),
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists events_profile_idx on public.events (profile_id, at desc);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_uid_idx on public.events (uid, created_at);

-- Удалить записи старше срока хранения (вызывается сама изредка и по расписанию pg_cron, если он включён)
create or replace function public.purge_old_events() returns int
language plpgsql security definer set search_path = '' as $$
declare m int; n int;
begin
  select least(12, greatest(1, coalesce((value #>> '{}')::int, 12))) into m from public.app_settings where key = 'events_retention_months';
  delete from public.events where id in (
    select id from public.events where created_at < now() - make_interval(months => coalesce(m, 12)) limit 20000);
  get diagnostics n = row_count;
  return n;
end $$;

-- Приложение присылает пачку событий (до 50 за раз). Профиль и время сервер ставит сам
create or replace function public.log_events(p_events jsonb, p_sid text default '', p_device text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid(); pid uuid := public.me();
begin
  if who is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  -- не больше 3000 событий в час с одной сессии: остальное молча отбрасываем
  if (select count(*) from (select 1 from public.events where uid = who and created_at > now() - interval '1 hour' limit 3000) t) >= 3000 then return; end if;
  insert into public.events (profile_id, uid, sid, device, name, screen, target, props, at)
  select pid, who, left(coalesce(p_sid, ''), 40), left(coalesce(p_device, ''), 20), e->>'n',
    left(e->>'s', 60), left(e->>'t', 80),
    case when jsonb_typeof(e->'p') = 'object' and pg_column_size(e->'p') < 1000 then e->'p' else '{}'::jsonb end,
    case when jsonb_typeof(e->'at') = 'number' and (e->>'at')::float8 between extract(epoch from now() - interval '1 day') * 1000 and extract(epoch from now()) * 1000 + 60000
      then to_timestamp((e->>'at')::float8 / 1000) else now() end
  from (select value e from jsonb_array_elements(p_events) limit 50) x
  where jsonb_typeof(e) = 'object' and coalesce(e->>'n', '') ~ '^[a-z_]{1,32}$';
  if random() < 0.01 then perform public.purge_old_events(); end if;
end $$;

-- Человек может стереть свою историю действий (право на удаление, GDPR)
create or replace function public.forget_my_events() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.events where uid = auth.uid() or (public.me() is not null and profile_id = public.me());
end $$;

create or replace function public.need_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Только для администратора' using errcode = '42501'; end if;
end $$;

-- Админка: итоги за период
create or replace function public.admin_overview(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(366, greatest(1, coalesce(p_days, 7))); since timestamptz; r jsonb;
begin
  perform public.need_admin();
  since := now() - make_interval(days => d);
  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new', (select count(*) from public.profiles where created_at > since),
    'active_today', (select count(distinct profile_id) from public.events where at > date_trunc('day', now())),
    'active', (select count(distinct profile_id) from public.events where at > since),
    'guests', (select count(distinct uid) from public.events where at > since and profile_id is null),
    'events', (select count(*) from public.events where at > since),
    'routes', (select count(*) from public.routes where created_at > since),
    'requests', (select count(*) from public.requests where created_at > since),
    'bookings', (select count(*) from public.bookings where created_at > since),
    'by_name', coalesce((select jsonb_object_agg(name, n) from (select name, count(*) n from public.events where at > since group by name) t), '{}'::jsonb),
    'screens', coalesce((select jsonb_agg(jsonb_build_object('k', screen, 'n', n) order by n desc) from
      (select screen, count(*) n from public.events where at > since and name = 'screen' group by screen order by n desc limit 12) t), '[]'::jsonb),
    'clicks', coalesce((select jsonb_agg(jsonb_build_object('k', target, 'n', n) order by n desc) from
      (select target, count(*) n from public.events where at > since and name = 'click' group by target order by n desc limit 15) t), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', dd, 'n', n, 'u', u) order by dd desc) from
      (select date_trunc('day', at)::date dd, count(*) n, count(distinct coalesce(profile_id, uid)) u from public.events where at > since group by 1) t), '[]'::jsonb),
    'retention_months', (select value from public.app_settings where key = 'events_retention_months')
  ) into r;
  return r;
end $$;

-- Админка: список людей, последние активные сверху
create or replace function public.admin_users(p_q text default '', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(left(coalesce(p_q, ''), 100)); r jsonb;
begin
  perform public.need_admin();
  select coalesce(jsonb_agg(x order by x->>'last_at' desc nulls last), '[]'::jsonb) into r from (
    select jsonb_build_object('id', p.id, 'name', public.display_name(p.id), 'email', p.email, 'created_at', p.created_at,
      'last_at', (select max(at) from public.events e where e.profile_id = p.id),
      'n30', (select count(*) from public.events e where e.profile_id = p.id and e.at > now() - interval '30 days')) x
    from public.profiles p
    where q = '' or lower(p.name) like '%' || q || '%' or p.email like '%' || q || '%' or lower(coalesce(p.extra->>'cname', '')) like '%' || q || '%'
    order by (select max(at) from public.events e where e.profile_id = p.id) desc nulls last, p.created_at desc
    limit least(200, greatest(1, coalesce(p_limit, 50))) offset greatest(0, coalesce(p_offset, 0))) t;
  return r;
end $$;

-- Админка: лента действий одного человека (с конца, страницами)
create or replace function public.admin_user_events(p_profile uuid, p_before timestamptz default null, p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.need_admin();
  select coalesce(jsonb_agg(jsonb_build_object('at', at, 'n', name, 's', screen, 't', target, 'p', props, 'sid', sid, 'dev', device) order by at desc, id desc), '[]'::jsonb) into r
  from (select * from public.events where profile_id = p_profile and (p_before is null or at < p_before)
        order by at desc, id desc limit least(500, greatest(1, coalesce(p_limit, 200)))) t;
  return r;
end $$;

-- Админка: срок хранения истории, от 1 до 12 месяцев
create or replace function public.admin_set_retention(p_months int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.need_admin();
  if p_months is null or p_months < 1 or p_months > 12 then raise exception 'Срок от 1 до 12 месяцев' using errcode = '22023'; end if;
  insert into public.app_settings (key, value) values ('events_retention_months', to_jsonb(p_months))
    on conflict (key) do update set value = excluded.value;
  perform public.purge_old_events();
end $$;

-- Если в Supabase включено расширение pg_cron, чистка идёт каждую ночь в 03:15 (UTC)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gtg-purge-events', '15 3 * * *', 'select public.purge_old_events()');
  end if;
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
alter table public.events enable row level security;
alter table public.admins enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.profiles, public.sessions, public.login_requests, public.routes, public.requests,
  public.bookings, public.messages, public.reviews, public.events, public.admins, public.app_settings from anon, authenticated;
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
-- История действий: писать только через log_events, читать только админу
grant execute on function public.is_admin(), public.log_events(jsonb, text, text), public.forget_my_events(),
  public.admin_overview(int), public.admin_users(text, int, int), public.admin_user_events(uuid, timestamptz, int),
  public.admin_set_retention(int) to authenticated;
grant select on public.events to authenticated;
drop policy if exists events_admin_read on public.events;
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
revoke execute on function public.check_login_code(text, uuid, text) from authenticated;
grant execute on function public.check_login_code(text, uuid, text) to service_role;

-- Функция tg-login работает с базой как service_role. В новых проектах Supabase таблицы,
-- созданные через SQL, не получают права для service_role автоматически, поэтому даём их явно.
-- service_role есть только на сервере (в функции), в браузер он не попадает.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
