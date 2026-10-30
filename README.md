# go-transfer-go

Демо-приложение для поездок, посылок и перевозки машин по Европе: вход по номеру телефона, карта маршрутов (OpenStreetMap через MapLibre и OpenFreeMap), маршруты по дорогам и поиск адресов (Geoapify, ключ `GEO_KEY` в index.html; без ключа запасные OSRM и Nominatim), чат с водителем и бронь с сервисным сбором.

Сайт: https://autovinzare-code.github.io/go-transfer-go/ (пока репозиторий не переименован: https://autovinzare-code.github.io/dzhipies/)

Файлы:
- `index.html` — приложение целиком.
- `eumap.js` — границы стран (Natural Earth) для запасной карты.
- `euroads.js` — дороги и города Европы (Natural Earth) для запасной карты.
- `LAUNCH.md` — что нужно для настоящего запуска.

Данные демо хранятся только в браузере, SMS не отправляются.
