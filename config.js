/* Настройки сервера go-transfer-go.
   Пока поля пустые, приложение работает в демо-режиме: всё хранится только в браузере.
   Чтобы включить настоящий сервер, впишите адрес проекта Supabase и публичный ключ
   (Supabase → Project Settings → API: «Project URL» и «anon public» или «Publishable key»).
   Этот ключ публичный, его можно хранить в GitHub. Секретный ключ (service_role / secret) сюда НЕ вписывать. */
window.GTG_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
