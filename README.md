# go-transfer-go

Демо-приложение для поездок, посылок и перевозки машин по Европе: вход по номеру телефона, карта маршрутов (OpenStreetMap через MapLibre и OpenFreeMap), маршруты по дорогам (OSRM), поиск адресов (Nominatim), чат с водителем и бронь с сервисным сбором.

Сайт: https://autovinzare-code.github.io/go-transfer-go/ (пока репозиторий не переименован: https://autovinzare-code.github.io/dzhipies/)

Файлы:
- `index.html` — приложение целиком.
- `eumap.js` — границы стран (Natural Earth) для запасной карты.
- `euroads.js` — дороги и города Европы (Natural Earth) для запасной карты.
- `config.js` — адрес сервера Supabase. Пустой = демо-режим.
- `supabase/` — база данных (`schema.sql`) и функция входа через Telegram (`functions/tg-login`).
- `НАСТРОЙКА-СЕРВЕРА.md` — как включить сервер и вход через Telegram, по шагам.
- `LAUNCH.md` — что нужно для настоящего запуска.

Пока `config.js` пустой, данные хранятся только в браузере (демо). С заполненным `config.js` вход идёт через Telegram-бота (или код на почту), а маршруты, брони, чаты и отзывы хранятся в Supabase (бесплатный тариф).
