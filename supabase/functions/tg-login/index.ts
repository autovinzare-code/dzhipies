// go-transfer-go: вход через Telegram-бота. Бесплатно, без SMS.
//
// Одна функция делает три вещи:
//   1. POST от приложения {action:"start"}  → одноразовая ссылка на бота и код сверки.
//   2. POST от приложения {action:"check"}  → вошёл ли человек; если да, привязывает сессию к профилю.
//      POST {action:"logout_all"}           → выйти на всех устройствах.
//   3. POST от Telegram (webhook)           → бот просит номер или подтверждение входа.
//   GET ?setup=<TELEGRAM_WEBHOOK_SECRET>    → один раз подключить бота к этой функции.
//
// Секреты (Supabase → Edge Functions → Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
// необязательно ALLOWED_ORIGIN (адрес сайта, например https://autovinzare-code.github.io).
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
// В настройках функции выключите «Verify JWT»: Telegram не присылает JWT, приложение проверяется здесь.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const HOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const TTL_MIN = 10;

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
let botName = "";
async function getBotName() {
  if (!botName) botName = (await tg("getMe", {}))?.result?.username ?? "";
  return botName;
}

// ---------- Приложение ----------
async function appRequest(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "no_session" }, 401);
  let body: { action?: string; token?: string } = {};
  try { body = await req.json(); } catch { /* пустое тело */ }

  if (body.action === "start") {
    await db.from("login_requests").delete().lt("expires_at", minutesAgo(24 * 60));
    const { count } = await db.from("login_requests").select("id", { count: "exact", head: true })
      .eq("uid", uid).gt("created_at", minutesAgo(10));
    if ((count ?? 0) >= 5) return json({ error: "too_many" }, 429);
    const bot = await getBotName();
    if (!bot) return json({ error: "bot_not_configured" }, 500);
    const token = randomToken(), code = randomCode();
    const { error } = await db.from("login_requests").insert({ token_hash: await sha256(token), uid, code });
    if (error) return json({ error: "db" }, 500);
    return json({ link: `https://t.me/${bot}?start=${token}`, token, code, ttl: TTL_MIN * 60 });
  }

  if (body.action === "check") {
    if (typeof body.token !== "string" || body.token.length > 64) return json({ error: "bad_token" }, 400);
    const { data: row } = await db.from("login_requests").select("*")
      .eq("token_hash", await sha256(body.token)).eq("uid", uid).maybeSingle();
    if (!row) return json({ status: "expired" });
    if (row.status === "denied") return json({ status: "denied" });
    if (row.status !== "confirmed") {
      return json({ status: new Date(row.expires_at) < new Date() ? "expired" : row.status === "wait" ? "wait" : "pending" });
    }
    // Номер подтверждён в Telegram: находим или создаём профиль и привязываем к нему эту сессию
    let { data: prof } = await db.from("profiles").select("id").eq("telegram_id", row.telegram_id).maybeSingle();
    if (!prof) {
      const ins = await db.from("profiles")
        .insert({ telegram_id: row.telegram_id, phone: row.phone, phone_ok: true, name: (row.tg_name ?? "").slice(0, 60) })
        .select("id").single();
      if (ins.error) return json({ error: "db" }, 500);
      prof = ins.data;
    } else if (row.phone) {
      await db.from("profiles").update({ phone: row.phone, phone_ok: true }).eq("id", prof.id);
    }
    await db.from("sessions").upsert({ uid, profile_id: prof!.id });
    await db.from("login_requests").update({ status: "used" }).eq("id", row.id);
    return json({ status: "ok" });
  }

  if (body.action === "logout_all") {
    const { data: s } = await db.from("sessions").select("profile_id").eq("uid", uid).maybeSingle();
    if (!s) return json({ error: "no_profile" }, 403);
    const { data: all } = await db.from("sessions").select("uid").eq("profile_id", s.profile_id);
    // Удаляем сами сессии Supabase: их токены обновления перестают работать
    for (const x of all ?? []) await db.auth.admin.deleteUser(x.uid).catch(() => {});
    await db.from("sessions").delete().eq("profile_id", s.profile_id);
    return json({ status: "ok" });
  }

  return json({ error: "unknown_action" }, 400);
}

// ---------- Telegram ----------
const SITE = "go-transfer-go";
type TgUser = { id: number; first_name?: string; last_name?: string };

async function pendingFor(tgId: number) {
  const { data } = await db.from("login_requests").select("*").eq("telegram_id", tgId).eq("status", "wait")
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function onStart(chatId: number, from: TgUser, token: string) {
  const { data: row } = await db.from("login_requests").select("*").eq("token_hash", await sha256(token)).maybeSingle();
  if (!row || row.status !== "new" || new Date(row.expires_at) < new Date()) {
    return tg("sendMessage", { chat_id: chatId, text: `Эта ссылка для входа устарела. Вернитесь на сайт ${SITE} и нажмите «Войти через Telegram» ещё раз.` });
  }
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 60);
  await db.from("login_requests").update({ status: "wait", telegram_id: from.id, chat_id: chatId, tg_name: name }).eq("id", row.id);
  const { data: prof } = await db.from("profiles").select("id").eq("telegram_id", from.id).maybeSingle();
  const warn = `Код на сайте должен быть ${row.code}. Если вы сейчас не входите в ${SITE} или код другой, ничего не нажимайте: кто-то пытается войти от вашего имени.`;
  if (prof) {
    return tg("sendMessage", {
      chat_id: chatId,
      text: `Вход в ${SITE}.\n\n${warn}`,
      reply_markup: { inline_keyboard: [[{ text: "✅ Да, это я, войти", callback_data: `ok:${row.id}` }], [{ text: "Это не я", callback_data: `no:${row.id}` }]] },
    });
  }
  return tg("sendMessage", {
    chat_id: chatId,
    text: `Добро пожаловать в ${SITE}! Чтобы подтвердить номер телефона, нажмите кнопку «📱 Поделиться номером» внизу.\n\n${warn}`,
    reply_markup: { keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  });
}

async function onContact(chatId: number, from: TgUser, contact: { user_id?: number; phone_number: string }) {
  if (contact.user_id !== from.id) {
    return tg("sendMessage", { chat_id: chatId, text: "Нужен ваш собственный номер. Нажмите кнопку «📱 Поделиться номером» внизу." });
  }
  const row = await pendingFor(from.id);
  if (!row) return tg("sendMessage", { chat_id: chatId, text: `Сначала нажмите «Войти через Telegram» на сайте ${SITE}.`, reply_markup: { remove_keyboard: true } });
  const phone = "+" + String(contact.phone_number).replace(/\D/g, "");
  if (!/^\+\d{7,15}$/.test(phone)) return tg("sendMessage", { chat_id: chatId, text: "Не получилось прочитать номер. Попробуйте ещё раз." });
  await db.from("login_requests").update({ status: "confirmed", phone }).eq("id", row.id);
  return tg("sendMessage", { chat_id: chatId, text: "✅ Номер подтверждён. Вернитесь на сайт, вход произойдёт сам.", reply_markup: { remove_keyboard: true } });
}

async function onButton(q: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } }) {
  const [act, id] = String(q.data ?? "").split(":");
  const row = await pendingFor(q.from.id);
  if (!row || row.id !== id || (act !== "ok" && act !== "no")) {
    return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Ссылка устарела, начните вход на сайте заново." });
  }
  await db.from("login_requests").update({ status: act === "ok" ? "confirmed" : "denied" }).eq("id", row.id);
  await tg("answerCallbackQuery", { callback_query_id: q.id });
  if (q.message) {
    await tg("editMessageText", {
      chat_id: q.message.chat.id, message_id: q.message.message_id,
      text: act === "ok" ? "✅ Вход подтверждён. Вернитесь на сайт." : "Вход отменён. Если это были не вы, просто ничего не делайте: без вашего подтверждения войти нельзя.",
    });
  }
}

// deno-lint-ignore no-explicit-any
async function telegramUpdate(u: any) {
  const m = u.message;
  if (m && m.chat?.type === "private" && m.from) {
    const start = /^\/start(?:\s+([A-Za-z0-9_-]{20,64}))?$/.exec(String(m.text ?? "").trim());
    if (start && start[1]) return onStart(m.chat.id, m.from, start[1]);
    if (m.contact) return onContact(m.chat.id, m.from, m.contact);
    return tg("sendMessage", { chat_id: m.chat.id, text: `Этот бот нужен только для входа в ${SITE}. Откройте сайт и нажмите «Войти через Telegram».` });
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
      { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (req.method !== "POST") return new Response("Not found", { status: 404 });

  const tgSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (tgSecret !== null) {
    if (!sameSecret(tgSecret, HOOK_SECRET)) return new Response("forbidden", { status: 403 });
    try { await telegramUpdate(await req.json()); } catch (e) { console.error("telegram update failed", e instanceof Error ? e.message : e); }
    return new Response("ok"); // Telegram должен получить 200, иначе будет присылать то же самое снова
  }

  try { return await appRequest(req); } catch (e) {
    console.error("app request failed", e instanceof Error ? e.message : e);
    return json({ error: "server" }, 500);
  }
});
