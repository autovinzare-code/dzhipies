// go-transfer-go: Telegram-бот для входа. Бесплатно, без SMS.
//
// Регистрация идёт по почте (код из письма присылает сам Supabase). Эта функция делает остальное:
//   POST от приложения {action:"link_start"}            → ссылка на бота, чтобы подключить Telegram к профилю.
//   POST {action:"link_check", token}                   → подключён ли Telegram.
//   POST {action:"login_code", email}                   → бот присылает в Telegram код входа из 6 цифр.
//   POST {action:"login_verify", token, code}           → проверить код и войти.
//   POST {action:"logout_all"}                          → выйти на всех устройствах.
//   POST от Telegram (webhook)                          → кнопка «Поделиться номером», кнопка «Это не я».
//   GET ?setup=<TELEGRAM_WEBHOOK_SECRET>                → один раз подключить бота к этой функции.
//
// Секреты (Supabase → Edge Functions → Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
// ALLOWED_ORIGIN (адрес сайта без / в конце, по умолчанию https://autovinzare-code.github.io).
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
// В настройках функции выключите «Verify JWT»: Telegram не присылает JWT, приложение проверяется здесь.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const HOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ORIGIN = (Deno.env.get("ALLOWED_ORIGIN") ?? "https://autovinzare-code.github.io").replace(/\/+$/, "");
const SITE = "go-transfer-go";
const LINK_TTL_MIN = 10;
const CODE_TTL_MIN = 5;

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Случайное число без перекоса: отбрасываем значения из «хвоста» диапазона
function randomInt(n: number) {
  const lim = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const v = crypto.getRandomValues(new Uint32Array(1))[0];
    if (v < lim) return v % n;
  }
}
const randomCode4 = () => String(1000 + randomInt(9000));
const randomCode6 = () => String(randomInt(1_000_000)).padStart(6, "0");
// Код входа хранится только как хэш, «посоленный» секретом вебхука и одноразовым токеном
const codeHash = (tokenHash: string, code: string) => sha256(`${HOOK_SECRET}:${tokenHash}:${code}`);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const okToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);

async function tg(method: string, body: unknown) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch {
    return { ok: false }; // текст ошибки не пишем в логи: в нём может быть адрес с токеном бота
  }
}
let botName = "";
async function getBotName() {
  if (!botName) botName = (await tg("getMe", {}))?.result?.username ?? "";
  return botName;
}
async function recent(filter: Record<string, unknown>, minutes: number) {
  let q = db.from("login_requests").select("id", { count: "exact", head: true }).gt("created_at", minutesAgo(minutes));
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}
function clientIp(req: Request) {
  return (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

// ---------- Приложение ----------
async function appRequest(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "no_session" }, 401);
  let body: { action?: string; token?: string; code?: string; email?: string } = {};
  try { body = await req.json(); } catch { /* пустое тело */ }
  const myProfile = async () =>
    (await db.from("sessions").select("profile_id").eq("uid", uid).maybeSingle()).data?.profile_id as string | undefined;

  // Старые заявки чистим заодно
  await db.from("login_requests").delete().lt("expires_at", minutesAgo(24 * 60));

  // ----- Подключить Telegram к своему профилю (после регистрации по почте) -----
  if (body.action === "link_start") {
    const pid = await myProfile();
    if (!pid) return json({ error: "no_profile" }, 403);
    if ((await recent({ uid, kind: "link" }, 10)) >= 5) return json({ error: "too_many" }, 429);
    const bot = await getBotName();
    if (!bot) return json({ error: "bot_not_configured" }, 500);
    const token = randomToken(), code = randomCode4();
    const { error } = await db.from("login_requests").insert({
      token_hash: await sha256(token), uid, kind: "link", profile_id: pid, code, expires_at: inMinutes(LINK_TTL_MIN),
    });
    if (error) return json({ error: "db" }, 500);
    return json({ link: `https://t.me/${bot}?start=${token}`, token, code, ttl: LINK_TTL_MIN * 60 });
  }

  if (body.action === "link_check") {
    if (!okToken(body.token)) return json({ error: "bad_token" }, 400);
    const { data: row } = await db.from("login_requests").select("*")
      .eq("token_hash", await sha256(body.token)).eq("uid", uid).eq("kind", "link").maybeSingle();
    if (!row) return json({ status: "expired" });
    if (row.status === "denied") return json({ status: "taken" });
    if (row.status !== "confirmed") {
      return json({ status: new Date(row.expires_at) < new Date() ? "expired" : row.status === "wait" ? "wait" : "pending" });
    }
    const { data: other } = await db.from("profiles").select("id").eq("telegram_id", row.telegram_id).maybeSingle();
    if (other && other.id !== row.profile_id) return json({ status: "taken" });
    const upd = await db.from("profiles")
      .update({ telegram_id: row.telegram_id, phone: row.phone, phone_ok: true }).eq("id", row.profile_id);
    if (upd.error) return json({ status: "taken" });
    await db.from("login_requests").update({ status: "used" }).eq("id", row.id);
    await tg("sendMessage", { chat_id: row.chat_id, text: `✅ Telegram подключён к ${SITE}. Теперь коды для входа будут приходить сюда.` });
    return json({ status: "ok" });
  }

  // ----- Вход: код из 6 цифр приходит в Telegram -----
  if (body.action === "login_code") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);
    const ipHash = clientIp(req) ? await sha256(`${HOOK_SECRET}:ip:${clientIp(req)}`) : null;
    if ((await recent({ uid, kind: "login" }, 10)) >= 5) return json({ error: "too_many" }, 429);
    if (ipHash && (await recent({ ip_hash: ipHash, kind: "login" }, 60)) >= 30) return json({ error: "too_many" }, 429);
    // Ответ всегда одинаковый, есть такой аккаунт или нет: так нельзя узнать, чья почта зарегистрирована
    const token = randomToken();
    const reply = json({ status: "sent", token, ttl: CODE_TTL_MIN * 60, bot: await getBotName() });
    // Запись создаём всегда, даже если такой почты нет: тогда и лимиты выше срабатывают одинаково
    const th = await sha256(token);
    const ins = await db.from("login_requests").insert({
      token_hash: th, uid, kind: "login", ip_hash: ipHash, status: "failed", expires_at: inMinutes(CODE_TTL_MIN),
    }).select("id").single();
    if (ins.error) return reply;
    // Аккаунт ищем и код отправляем уже после ответа: так и по времени ответа нельзя понять, есть ли такая почта
    const work = (async () => {
      const { data: prof } = await db.from("profiles").select("id, telegram_id").eq("email", email).maybeSingle();
      if (!prof?.telegram_id) return;
      // Не больше 10 кодов в час на один аккаунт: защита от рассылки спама человеку в Telegram
      if ((await recent({ profile_id: prof.id, kind: "login" }, 60)) >= 10) return;
      const code = randomCode6();
      const upd = await db.from("login_requests").update({
        profile_id: prof.id, telegram_id: prof.telegram_id, chat_id: prof.telegram_id,
        code_hash: await codeHash(th, code), status: "sent",
      }).eq("id", ins.data.id);
      if (upd.error) return;
      const sent = await tg("sendMessage", {
        chat_id: prof.telegram_id,
        parse_mode: "HTML",
        protect_content: true,
        text: `🔐 Код для входа в ${SITE}: <b>${code}</b>\n\n` +
          `Код действует ${CODE_TTL_MIN} минут. Никому не сообщайте его: ни водителю, ни пассажиру, ни «поддержке». ` +
          `Настоящий ${SITE} никогда не спрашивает этот код.\n\nЕсли вы сейчас не входите, нажмите «Это не я».`,
        reply_markup: { inline_keyboard: [[{ text: "🚫 Это не я", callback_data: `no:${ins.data.id}` }]] },
      });
      if (!sent?.ok) await db.from("login_requests").update({ status: "failed" }).eq("id", ins.data.id);
    })().catch(() => {});
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(work); else await work;
    return reply;
  }

  if (body.action === "login_verify") {
    if (!okToken(body.token)) return json({ error: "bad_token" }, 400);
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) return json({ status: "bad" });
    const th = await sha256(body.token);
    const { data, error } = await db.rpc("check_login_code", { p_token_hash: th, p_uid: uid, p_code_hash: await codeHash(th, code) });
    if (error) return json({ error: "db" }, 500);
    if (data?.status === "ok" && data.telegram_id) {
      const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Chisinau", dateStyle: "short", timeStyle: "short" });
      await tg("sendMessage", {
        chat_id: data.telegram_id,
        text: `✅ Выполнен вход в ${SITE} (${when}, по времени Кишинёва).\n\nЕсли это были не вы, откройте профиль и нажмите «Выйти на всех устройствах».`,
      });
    }
    return json({ status: data?.status ?? "bad" });
  }

  if (body.action === "logout_all") {
    const pid = await myProfile();
    if (!pid) return json({ error: "no_profile" }, 403);
    const { data: all } = await db.from("sessions").select("uid").eq("profile_id", pid);
    // Удаляем сами сессии Supabase: их токены обновления перестают работать
    for (const x of all ?? []) await db.auth.admin.deleteUser(x.uid).catch(() => {});
    await db.from("sessions").delete().eq("profile_id", pid);
    await db.from("login_requests").update({ status: "used" }).eq("profile_id", pid).in("status", ["sent", "new", "wait", "confirmed"]);
    return json({ status: "ok" });
  }

  return json({ error: "unknown_action" }, 400);
}

// ---------- Telegram ----------
type TgUser = { id: number; first_name?: string; last_name?: string; is_bot?: boolean };

async function pendingLink(tgId: number) {
  const { data } = await db.from("login_requests").select("*").eq("telegram_id", tgId).eq("kind", "link").eq("status", "wait")
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function onStart(chatId: number, from: TgUser, token: string) {
  const { data: row } = await db.from("login_requests").select("*")
    .eq("token_hash", await sha256(token)).eq("kind", "link").maybeSingle();
  if (!row || row.status !== "new" || new Date(row.expires_at) < new Date()) {
    return tg("sendMessage", { chat_id: chatId, text: `Эта ссылка устарела. Вернитесь на сайт ${SITE} и нажмите «Подключить Telegram» ещё раз.` });
  }
  const { data: other } = await db.from("profiles").select("id").eq("telegram_id", from.id).maybeSingle();
  if (other && other.id !== row.profile_id) {
    await db.from("login_requests").update({ status: "denied" }).eq("id", row.id);
    return tg("sendMessage", {
      chat_id: chatId,
      text: `Этот Telegram уже подключён к другому аккаунту ${SITE}. Войдите в тот аккаунт: введите его почту на сайте, и код придёт сюда.`,
    });
  }
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 60);
  await db.from("login_requests").update({ status: "wait", telegram_id: from.id, chat_id: chatId, tg_name: name }).eq("id", row.id);
  return tg("sendMessage", {
    chat_id: chatId,
    text: `Подключение Telegram к ${SITE}.\n\nНа сайте должен быть код ${row.code}. Если код другой или вы сейчас ничего не подключаете, ничего не нажимайте.\n\n` +
      `Чтобы подтвердить номер телефона, нажмите кнопку «📱 Поделиться номером» внизу.`,
    reply_markup: { keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  });
}

async function onContact(chatId: number, from: TgUser, contact: { user_id?: number; phone_number: string }) {
  if (contact.user_id !== from.id) {
    return tg("sendMessage", { chat_id: chatId, text: "Нужен ваш собственный номер. Нажмите кнопку «📱 Поделиться номером» внизу." });
  }
  const row = await pendingLink(from.id);
  if (!row) return tg("sendMessage", { chat_id: chatId, text: `Сначала нажмите «Подключить Telegram» на сайте ${SITE}.`, reply_markup: { remove_keyboard: true } });
  const phone = "+" + String(contact.phone_number).replace(/\D/g, "");
  if (!/^\+\d{7,15}$/.test(phone)) return tg("sendMessage", { chat_id: chatId, text: "Не получилось прочитать номер. Попробуйте ещё раз." });
  await db.from("login_requests").update({ status: "confirmed", phone }).eq("id", row.id);
  return tg("sendMessage", { chat_id: chatId, text: "✅ Номер подтверждён. Вернитесь на сайт, всё остальное произойдёт само.", reply_markup: { remove_keyboard: true } });
}

// Кнопка «Это не я» под кодом входа: код сразу перестаёт действовать
async function onButton(q: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } }) {
  const m = /^no:([0-9a-f-]{36})$/.exec(String(q.data ?? ""));
  const { data: row } = m
    ? await db.from("login_requests").select("id, status, telegram_id").eq("id", m[1]).eq("kind", "login").maybeSingle()
    : { data: null };
  if (!row || row.telegram_id !== q.from.id) {
    return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Этот код уже не действует." });
  }
  if (row.status === "sent") await db.from("login_requests").update({ status: "denied" }).eq("id", row.id);
  await tg("answerCallbackQuery", { callback_query_id: q.id });
  if (q.message) {
    await tg("editMessageText", {
      chat_id: q.message.chat.id, message_id: q.message.message_id,
      text: row.status === "used"
        ? "⚠️ Этим кодом уже вошли. Если это были не вы, откройте профиль на сайте и нажмите «Выйти на всех устройствах»."
        : "Код отменён, войти с ним нельзя. Без кода из этого чата в ваш аккаунт не войти, так что можно ничего не делать.",
    });
  }
}

// deno-lint-ignore no-explicit-any
async function telegramUpdate(u: any) {
  const m = u.message;
  if (m && m.chat?.type === "private" && m.from && !m.from.is_bot) {
    const start = /^\/start(?:\s+([A-Za-z0-9_-]{20,64}))?$/.exec(String(m.text ?? "").trim());
    if (start && start[1]) return onStart(m.chat.id, m.from, start[1]);
    if (m.contact) return onContact(m.chat.id, m.from, m.contact);
    return tg("sendMessage", {
      chat_id: m.chat.id,
      text: `Этот бот присылает коды для входа в ${SITE}. Код придёт сам, когда вы впишете свою почту на сайте. Никому не пересылайте коды из этого чата.`,
    });
  }
  if (u.callback_query) return onButton(u.callback_query);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.has("setup")) {
    if (!sameSecret(url.searchParams.get("setup") ?? "", HOOK_SECRET)) return new Response("Неверный секрет", { status: 403 });
    const r = await tg("setWebhook", {
      url: `${SB_URL}/functions/v1/tg-login`, secret_token: HOOK_SECRET,
      allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
    });
    const bot = await getBotName();
    return new Response(r?.ok ? `Готово! Бот @${bot} подключён.` : `Ошибка Telegram: ${r?.description ?? "нет ответа"}`,
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (req.method !== "POST") return new Response("Not found", { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > 64_000) return new Response("too large", { status: 413 });

  const tgSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (tgSecret !== null) {
    if (!sameSecret(tgSecret, HOOK_SECRET)) return new Response("forbidden", { status: 403 });
    try { await telegramUpdate(await req.json()); } catch (e) { console.error("telegram update failed", e instanceof Error ? e.name : "error"); }
    return new Response("ok"); // Telegram должен получить 200, иначе будет присылать то же самое снова
  }

  try { return await appRequest(req); } catch (e) {
    console.error("app request failed", e instanceof Error ? e.name : "error");
    return json({ error: "server" }, 500);
  }
});
