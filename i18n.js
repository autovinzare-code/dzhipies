/* Языки интерфейса: русский, румынский, английский.
   Код приложения пишет тексты по-русски. Этот файл переводит их на лету:
   следит за страницей и меняет русский текст на выбранный язык.
   Словарь: "русский текст": ["română", "English"]. {} в ключе означает любое значение
   (число, город, имя); в переводе {} подставляются по порядку, {1} {2} по номеру.
   Чтобы добавить перевод, допишите строку в словарь D ниже. */
(function(){
const LS="gps4_lang",SUP=["ru","ro","en"],LOCALE={ru:"ru-RU",ro:"ro-RO",en:"en-GB"};
function detect(){
  try{const v=JSON.parse(localStorage.getItem(LS));if(SUP.includes(v))return v}catch(e){}
  const ls=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
  for(const l of ls){const c=String(l).toLowerCase().slice(0,2);
    if(c==="ru"||c==="uk"||c==="be"||c==="kk")return "ru";if(c==="ro"||c==="mo")return "ro";if(c==="en")return "en"}
  return "en";
}
const L=detect(),IX=L==="ro"?0:1;
document.documentElement.lang=L;

const D={
/* Общее и ошибки */
"Слишком много попыток. Подождите пару минут":["Prea multe încercări. Așteptați câteva minute","Too many attempts. Please wait a couple of minutes"],
"Ошибка сервера ({}). Попробуйте ещё раз":["Eroare de server ({}). Încercați din nou","Server error ({}). Please try again"],
"Нет связи с сервером. Попробуйте ещё раз":["Nu există conexiune cu serverul. Încercați din nou","No connection to the server. Please try again"],
"Пассажиры":["Pasageri","Passengers"],"мест":["locuri","seats"],"места":["locuri","seats"],"место":["loc","seat"],"за место":["pe loc","per seat"],
"Посылки":["Colete","Parcels"],"кг":["kg","kg"],"за кг":["pe kg","per kg"],
"Трал":["Platformă auto","Car carrier"],"авто":["auto","cars"],"за авто":["pe auto","per car"],
"Перегон":["Transfer auto","Car delivery"],"за перегон":["pe transfer","per delivery"],
"Ищу место":["Caut un loc","Looking for a seat"],"Ищу, кто возьмёт посылку":["Caut pe cineva să ia un colet","Looking for someone to take a parcel"],
"Ищу трал для машины":["Caut platformă pentru mașină","Looking for a car carrier"],"Ищу, кто пригонит машину":["Caut pe cineva să-mi aducă mașina","Looking for someone to drive my car here"],
"лей":["lei","lei"],"лея":["lei","lei"],"леев":["lei","lei"],
"Открыть чат":["Deschide chatul","Open chat"],"Профиль человека":["Profilul persoanei","Person's profile"],
"Пользователь":["Utilizator","User"],"Водитель":["Șofer","Driver"],"Гость":["Oaspete","Guest"],
"Нет связи с сервером. Данные обновятся позже":["Nu există conexiune cu serverul. Datele se vor actualiza mai târziu","No connection to the server. Data will update later"],
"Сессия закончилась, войдите ещё раз":["Sesiunea a expirat, intrați din nou","Your session has ended, please sign in again"],
"Закрыть":["Închide","Close"],"Хорошо":["Bine","OK"],"Отмена":["Anulare","Cancel"],"Назад":["Înapoi","Back"],"Дальше":["Mai departe","Next"],
"Готово":["Gata","Done"],"Изменить":["Modifică","Change"],"Подтвердить":["Confirmă","Confirm"],"Сохранить":["Salvează","Save"],
"Понятно":["Am înțeles","Got it"],"Позже":["Mai târziu","Later"],"Найти":["Caută","Search"],"Убрать":["Elimină","Remove"],
"Написать":["Scrie","Message"],"Отправить":["Trimite","Send"],"Сообщение":["Mesaj","Message"],"Загружаем…":["Se încarcă…","Loading…"],
"Подробнее":["Detalii","More"],"необязательно":["opțional","optional"],"если есть":["dacă aveți","if any"],
/* Дата и время */
"сегодня":["azi","today"],"завтра":["mâine","tomorrow"],"послезавтра":["poimâine","the day after tomorrow"],"вчера":["ieri","yesterday"],
"скоро":["în curând","soon"],"через {} ч":["peste {} h","in {} h"],"через {} дн.":["peste {} zile","in {} days"],
"опубл.":["publicat","posted"],"Опубликовано":["Publicat","Posted"],"Опубликовано: {}":["Publicat: {}","Posted: {}"],
/* История действий и конфиденциальность */
"История действий":["Istoricul acțiunilor","Activity history"],
"Чтобы делать приложение удобнее, мы можем записывать, какие экраны вы открываете и какие кнопки нажимаете. Пароли, коды входа, текст сообщений и то, что вы печатаете, не записываем никогда. История хранится не дольше 12 месяцев, её видит только администратор.":["Ca să facem aplicația mai comodă, putem înregistra ce ecrane deschideți și ce butoane apăsați. Parolele, codurile de intrare, textul mesajelor și ce scrieți nu le înregistrăm niciodată. Istoricul se păstrează cel mult 12 luni și îl vede doar administratorul.","To make the app easier to use, we can record which screens you open and which buttons you tap. We never record passwords, login codes, message text or anything you type. The history is kept for no longer than 12 months and only the administrator can see it."],
"Разрешаю":["Permit","Allow"],"Не надо":["Nu, mulțumesc","No thanks"],
"Спасибо! Выключить можно в профиле":["Mulțumim! Puteți dezactiva în profil","Thank you! You can turn it off in your profile"],
"Хорошо, ничего не записываем":["Bine, nu înregistrăm nimic","OK, we won't record anything"],
"включена":["activată","on"],"выключена":["dezactivată","off"],"Выключить запись":["Dezactivează înregistrarea","Turn off recording"],
"Разрешить запись":["Permite înregistrarea","Allow recording"],"Стереть мою историю":["Șterge istoricul meu","Erase my history"],
"Конфиденциальность":["Confidențialitate","Privacy"],"Что мы храним.":["Ce păstrăm.","What we store."],
"Почту, имя, номер телефона (если вы его дали), подключён ли Telegram, ваши объявления, брони, отзывы и переписку. Номер телефона видит только тот, с кем у вас бронь. Переписку видите только вы и собеседник.":["E-mailul, numele, numărul de telefon (dacă l-ați dat), dacă Telegram e conectat, anunțurile, rezervările, recenziile și mesajele dvs. Numărul de telefon îl vede doar persoana cu care aveți o rezervare. Mesajele le vedeți doar dvs. și interlocutorul.","Your email, name, phone number (if you gave it), whether Telegram is connected, your listings, bookings, reviews and messages. Your phone number is only visible to the person you have a booking with. Only you and the other person can see your messages."],
"История действий.":["Istoricul acțiunilor.","Activity history."],
"Только если вы разрешили: какие экраны вы открываете, на какие кнопки нажимаете, какой город выбрали в поиске, когда подали объявление или бронь, когда вошли и вышли. Пароли, коды входа, текст сообщений и то, что вы печатаете, не записываются. Историю видит только администратор, чтобы находить ошибки и делать приложение удобнее. Она хранится не дольше 12 месяцев и потом удаляется сама. Мы не продаём и не передаём её рекламным сетям.":["Doar dacă ați permis: ce ecrane deschideți, ce butoane apăsați, ce oraș ați ales în căutare, când ați publicat un anunț sau o rezervare, când ați intrat și ați ieșit. Parolele, codurile de intrare, textul mesajelor și ce scrieți nu se înregistrează. Istoricul îl vede doar administratorul, ca să găsească erori și să facă aplicația mai comodă. Se păstrează cel mult 12 luni, apoi se șterge singur. Nu îl vindem și nu îl dăm rețelelor de publicitate.","Only if you allowed it: which screens you open, which buttons you tap, which city you chose in search, when you posted a listing or booking, when you signed in and out. Passwords, login codes, message text and anything you type are not recorded. Only the administrator sees the history, to find bugs and make the app easier to use. It is kept for no longer than 12 months and then deleted automatically. We never sell it or share it with ad networks."],
"Ваши права.":["Drepturile dvs.","Your rights."],
"Можно в любой момент выключить запись истории, стереть её или удалить аккаунт со всеми данными: всё это в профиле. Вопросы пишите в чат поддержки.":["Oricând puteți dezactiva înregistrarea istoricului, îl puteți șterge sau puteți șterge contul cu toate datele: totul din profil. Întrebările le scrieți în chatul de suport.","At any time you can turn off history recording, erase it, or delete your account with all data: all of this is in your profile. Send questions to the support chat."],
"Сейчас запись истории:":["Acum înregistrarea istoricului este:","History recording is now:"],
"Запись истории включена":["Înregistrarea istoricului este activată","History recording is on"],"Запись истории выключена":["Înregistrarea istoricului este dezactivată","History recording is off"],
"Ваша история действий стёрта":["Istoricul acțiunilor a fost șters","Your activity history has been erased"],
/* Вход */
"Не получилось открыть Google. Попробуйте ещё раз":["Nu s-a putut deschide Google. Încercați din nou","Couldn't open Google. Please try again"],
"Вход через Google ещё не включён на сервере":["Intrarea cu Google nu este încă activată pe server","Google sign-in is not enabled on the server yet"],
"Вход через Google отменён":["Intrarea cu Google a fost anulată","Google sign-in was cancelled"],
"Время входа вышло. Нажмите «Войти через Google» ещё раз":["Timpul a expirat. Apăsați din nou «Intră cu Google»","Time ran out. Tap “Sign in with Google” again"],
"Не удалось войти через Google. Попробуйте ещё раз":["Nu s-a putut intra cu Google. Încercați din nou","Couldn't sign in with Google. Please try again"],
"К аккаунту подключён Telegram. Отправили туда код для входа":["Contul are Telegram conectat. V-am trimis acolo codul de intrare","Telegram is connected to this account. We sent the login code there"],
"Вы вошли":["Ați intrat","You're signed in"],"Слишком много попыток. Подождите 10 минут":["Prea multe încercări. Așteptați 10 minute","Too many attempts. Please wait 10 minutes"],
"Бот ещё не настроен на сервере":["Botul nu este încă configurat pe server","The bot isn't set up on the server yet"],
"Подключите Telegram":["Conectați Telegram","Connect Telegram"],"Нажмите кнопку ниже, откроется наш бот.":["Apăsați butonul de mai jos, se va deschide botul nostru.","Tap the button below to open our bot."],
"Нажмите «Старт» (Start).":["Apăsați «Start».","Tap “Start”."],"Нажмите «📱 Поделиться номером».":["Apăsați «📱 Partajează numărul».","Tap “📱 Share phone number”."],
"Код сверки":["Cod de verificare","Check code"],"Бот покажет такой же код. Если код другой, ничего не нажимайте.":["Botul va arăta același cod. Dacă codul e altul, nu apăsați nimic.","The bot will show the same code. If the code is different, don't tap anything."],
"Открыть Telegram":["Deschide Telegram","Open Telegram"],"Ждём подтверждения…":["Așteptăm confirmarea…","Waiting for confirmation…"],
"Время вышло. Нажмите «Подключить Telegram» ещё раз":["Timpul a expirat. Apăsați din nou «Conectează Telegram»","Time ran out. Tap “Connect Telegram” again"],
"Бот открыт. Нажмите «Поделиться номером» в Telegram…":["Botul e deschis. Apăsați «Partajează numărul» în Telegram…","The bot is open. Tap “Share phone number” in Telegram…"],
"Этот Telegram уже подключён к другому аккаунту":["Acest Telegram este deja conectat la alt cont","This Telegram is already connected to another account"],
"Ссылка устарела, попробуйте ещё раз":["Linkul a expirat, încercați din nou","The link has expired, please try again"],
"Telegram подключён. Коды для входа будут приходить туда":["Telegram conectat. Codurile de intrare vor veni acolo","Telegram connected. Login codes will be sent there"],
"Код отправлен":["Cod trimis","Code sent"],"Сервер ещё не настроен: включите анонимный вход в Supabase":["Serverul nu este încă configurat: activați intrarea anonimă în Supabase","The server isn't set up yet: enable anonymous sign-in in Supabase"],
"Не удалось связаться с сервером. Попробуйте ещё раз":["Nu s-a putut contacta serverul. Încercați din nou","Couldn't reach the server. Please try again"],
"Входим через Google…":["Intrăm cu Google…","Signing in with Google…"],"Подождите пару секунд.":["Așteptați câteva secunde.","Please wait a few seconds."],
"Код из Telegram":["Codul din Telegram","Code from Telegram"],"Если аккаунт с почтой":["Dacă există un cont cu e-mailul","If an account with the email"],
"есть и к нему подключён Telegram, бот {} прислал вам код из 6 цифр.":["și are Telegram conectat, botul {} v-a trimis un cod din 6 cifre.","exists and has Telegram connected, the bot {} has sent you a 6-digit code."],
"есть и к нему подключён Telegram, бот прислал вам код из 6 цифр.":["și are Telegram conectat, botul v-a trimis un cod din 6 cifre.","exists and has Telegram connected, the bot has sent you a 6-digit code."],
"Код":["Cod","Code"],"Войти":["Intră","Sign in"],"Цифра {}":["Cifra {}","Digit {}"],
"Никому не сообщайте этот код. Мы никогда его не спрашиваем: ни в чате, ни по телефону.":["Nu spuneți nimănui acest cod. Noi nu îl cerem niciodată: nici în chat, nici la telefon.","Don't share this code with anyone. We never ask for it: not in chat, not by phone."],
"Код обычно приходит за несколько секунд. Если не пришёл и после повторной отправки, подождите час: мы ограничиваем число кодов, чтобы никто не мог засыпать вас сообщениями.":["Codul vine de obicei în câteva secunde. Dacă nu a venit nici după retrimitere, așteptați o oră: limităm numărul de coduri ca nimeni să nu vă poată bombarda cu mesaje.","The code usually arrives in a few seconds. If it still hasn't arrived after resending, wait an hour: we limit the number of codes so nobody can flood you with messages."],
"Код не пришёл? Отправить ещё раз":["Nu a venit codul? Trimite din nou","Didn't get the code? Send again"],
"Telegram ещё не подключён? Войти кодом из письма":["Telegram nu e conectat încă? Intră cu codul din e-mail","Telegram not connected yet? Sign in with an email code"],
"Изменить почту":["Schimbă e-mailul","Change email"],"Впишите все 6 цифр из Telegram":["Introduceți toate cele 6 cifre din Telegram","Enter all 6 digits from Telegram"],
"Слишком много неверных попыток. Запросите новый код":["Prea multe încercări greșite. Cereți un cod nou","Too many wrong attempts. Request a new code"],
"Код устарел. Запросите новый":["Codul a expirat. Cereți unul nou","The code has expired. Request a new one"],
"Код отменён кнопкой «Это не я» в Telegram":["Codul a fost anulat cu butonul «Nu sunt eu» în Telegram","The code was cancelled with the “It's not me” button in Telegram"],
"Код не подошёл. Проверьте цифры":["Codul nu se potrivește. Verificați cifrele","Wrong code. Check the digits"],
"Регистрация":["Înregistrare","Sign up"],"Вход кодом из письма":["Intrare cu codul din e-mail","Sign in with an email code"],
"Пришлём на почту код, чтобы убедиться, что почта ваша. Пароль не нужен.":["Vă trimitem un cod pe e-mail ca să verificăm că e-mailul e al dvs. Nu e nevoie de parolă.","We'll email you a code to make sure the address is yours. No password needed."],
"Подходит, только если к аккаунту ещё не подключён Telegram.":["Merge doar dacă la cont nu este încă conectat Telegram.","Only works if Telegram isn't connected to the account yet."],
"После почты подключите Telegram: туда будут приходить коды для входа. Это бесплатно, без SMS.":["După e-mail conectați Telegram: acolo vor veni codurile de intrare. E gratuit, fără SMS.","After the email, connect Telegram: login codes will be sent there. It's free, no SMS."],
"Или войти через Google":["Sau intră cu Google","Or sign in with Google"],"Электронная почта":["E-mail","Email"],
"Получить код на почту":["Primește codul pe e-mail","Get a code by email"],"Проверьте почту: в ней должны быть @ и точка":["Verificați e-mailul: trebuie să conțină @ și punct","Check the email: it must contain @ and a dot"],
"Код уже отправлен. Подождите минуту и попробуйте снова":["Codul a fost deja trimis. Așteptați un minut și încercați din nou","The code has already been sent. Wait a minute and try again"],
"Не удалось отправить письмо. Попробуйте позже":["Nu s-a putut trimite e-mailul. Încercați mai târziu","Couldn't send the email. Please try later"],
"Введите код из письма":["Introduceți codul din e-mail","Enter the code from the email"],
"Отправили на {}. Если письма нет, проверьте папку «Спам».":["L-am trimis la {}. Dacă nu e, verificați dosarul «Spam».","We sent it to {}. If it isn't there, check your Spam folder."],
". Если письма нет, проверьте папку «Спам».":[". Dacă nu e, verificați dosarul «Spam».",". If it isn't there, check your Spam folder."],
"Отправили на":["L-am trimis la","We sent it to"],
"Впишите все цифры из письма":["Introduceți toate cifrele din e-mail","Enter all the digits from the email"],
"Код не подошёл или устарел. Проверьте цифры":["Codul e greșit sau a expirat. Verificați cifrele","The code is wrong or expired. Check the digits"],
"Как вас зовут?":["Cum vă numiți?","What's your name?"],"Имя увидят водители и пассажиры в чате.":["Numele îl vor vedea șoferii și pasagerii în chat.","Drivers and passengers will see your name in chat."],
"Имя":["Nume","Name"],"Впишите имя":["Introduceți numele","Enter your name"],"Последний шаг: Telegram":["Ultimul pas: Telegram","Last step: Telegram"],
"Почта подтверждена. Теперь подключите Telegram: при каждом входе бот будет присылать туда код. Так в ваш аккаунт не войдёт никто, даже если узнает почту.":["E-mailul a fost confirmat. Acum conectați Telegram: la fiecare intrare botul va trimite acolo un cod. Astfel nimeni nu va intra în contul dvs., chiar dacă vă află e-mailul.","Email confirmed. Now connect Telegram: every time you sign in, the bot will send a code there. That way nobody can get into your account, even if they know your email."],
"Подключить Telegram":["Conectează Telegram","Connect Telegram"],
"Бот попросит поделиться номером телефона. Номер увидит только тот, с кем у вас будет бронь.":["Botul vă va cere să partajați numărul de telefon. Numărul îl va vedea doar persoana cu care veți avea o rezervare.","The bot will ask you to share your phone number. Only the person you have a booking with will see it."],
"Пока Telegram не подключён, входите кодом из письма":["Până conectați Telegram, intrați cu codul din e-mail","Until Telegram is connected, sign in with an email code"],
"Вход":["Intrare","Sign in"],
"Попутчики, посылки и перевозка машин по всей Европе. Бесплатно и без пароля: код для входа придёт в Telegram.":["Ocazii, colete și transport de mașini în toată Europa. Gratuit și fără parolă: codul de intrare vine în Telegram.","Rides, parcels and car transport across Europe. Free and no password: the login code comes to Telegram."],
"Почта, с которой вы регистрировались":["E-mailul cu care v-ați înregistrat","The email you signed up with"],"Получить код в Telegram":["Primește codul în Telegram","Get a code in Telegram"],
"Нет Telegram? Войдите через Google. Подходит и для первого входа: аккаунт создастся сам.":["Nu aveți Telegram? Intrați cu Google. Merge și la prima intrare: contul se creează singur.","No Telegram? Sign in with Google. Works for the first sign-in too: the account is created automatically."],
"Войти через Google":["Intră cu Google","Sign in with Google"],"Впервые здесь?":["Prima dată aici?","New here?"],"Зарегистрироваться по почте":["Înregistrare cu e-mail","Sign up with email"],
"Вход по номеру телефона":["Intrare cu numărul de telefon","Sign in with phone number"],"Номер телефона":["Număr de telefon","Phone number"],"Получить код":["Primește codul","Get code"],
"Вы вошли в демо-режиме":["Ați intrat în modul demo","You're signed in to demo mode"],"Введите код из SMS":["Introduceți codul din SMS","Enter the code from the SMS"],
"Код не совпал. Проверьте цифры":["Codul nu se potrivește. Verificați cifrele","The code doesn't match. Check the digits"],"Номер подтверждён":["Număr confirmat","Number confirmed"],
"Войти без SMS (демо)":["Intră fără SMS (demo)","Sign in without SMS (demo)"],"Проверьте номер: нужен код страны и номер":["Verificați numărul: trebuie prefixul țării și numărul","Check the number: country code and number are needed"],
"Попутчики, посылки и перевозка машин по всей Европе. Пароль не нужен, пришлём код в SMS.":["Ocazii, colete și transport de mașini în toată Europa. Fără parolă, vă trimitem codul prin SMS.","Rides, parcels and car transport across Europe. No password, we'll text you a code."],
"Подходит любой номер: Молдова, Румыния, Италия, Германия и другие страны.":["Merge orice număr: Moldova, România, Italia, Germania și alte țări.","Any number works: Moldova, Romania, Italy, Germany and other countries."],
/* Карта и поиск */
"Карта Европы с маршрутами":["Harta Europei cu rute","Map of Europe with routes"],
"Личный автомобиль":["Autoturism personal","Private car"],"Личный авто":["Auto personal","Private car"],"Маршрутный автобус":["Autobuz de linie","Scheduled bus"],"Автобус":["Autobuz","Bus"],
"Маршрутный микроавтобус":["Microbuz de linie","Scheduled minibus"],"Микроавтобус":["Microbuz","Minibus"],"Эвакуатор":["Tractări auto","Tow truck"],
"Трал на 2 машины":["Platformă pentru 2 mașini","Carrier for 2 cars"],"Грузовик":["Camion","Truck"],"Мотоцикл":["Motocicletă","Motorcycle"],"Самолёт":["Avion","Plane"],
"Эвакуатор-платформа, 1 авто":["Platformă de tractare, 1 auto","Flatbed tow truck, 1 car"],"Toyota Corolla, 4 места":["Toyota Corolla, 4 locuri","Toyota Corolla, 4 seats"],
"Setra, 50 мест":["Setra, 50 de locuri","Setra, 50 seats"],"Mercedes Sprinter, 18 мест":["Mercedes Sprinter, 18 locuri","Mercedes Sprinter, 18 seats"],"Рейс Милан – Кишинёв":["Zbor Milano – Chișinău","Flight Milan – Chișinău"],
"Едет без машины, пригонит вашу":["Vine fără mașină, o aduce pe a dvs.","Travels without a car, will drive yours"],"Частный водитель":["Șofer privat","Private driver"],
"Ждут транспорт: {}":["Așteaptă transport: {}","Waiting for transport: {}"],"Ждут транспорт: {}, человек: {}":["Așteaptă transport: {}, persoane: {}","Waiting for transport: {}, people: {}"],
"Отправление: {}, поездок: {}":["Plecare: {}, curse: {}","Departure: {}, trips: {}"],"Прибытие: {}, поездок: {}":["Sosire: {}, curse: {}","Arrival: {}, trips: {}"],
"Загружаем подробную карту…":["Se încarcă harta detaliată…","Loading the detailed map…"],"Загружаем подробную карту OpenStreetMap…":["Se încarcă harta detaliată OpenStreetMap…","Loading the detailed OpenStreetMap map…"],
"Карта © OpenStreetMap, OpenFreeMap. Маршрут по дорогам считает {}.":["Hartă © OpenStreetMap, OpenFreeMap. Ruta pe drumuri o calculează {}.","Map © OpenStreetMap, OpenFreeMap. Road routes by {}."],
"Карта дорог Европы: трассы, шоссе и основные дороги (Natural Earth). Приближайте, чтобы увидеть больше дорог и городов. Полная карта всех улиц OpenStreetMap работает в версии на сайте.":["Harta drumurilor Europei: autostrăzi, șosele și drumuri principale (Natural Earth). Măriți ca să vedeți mai multe drumuri și orașe. Harta completă OpenStreetMap funcționează în versiunea de pe site.","Road map of Europe: motorways, highways and main roads (Natural Earth). Zoom in to see more roads and towns. The full OpenStreetMap street map works in the website version."],
"Точка у {}":["Punct lângă {}","Point near {}"],
"Откуда: впишите город":["De unde: scrieți orașul","From: type a city"],"Куда: впишите город":["Unde: scrieți orașul","To: type a city"],
"Город отправления":["Orașul de plecare","Departure city"],"Город назначения":["Orașul de destinație","Destination city"],"Подходящие города":["Orașe potrivite","Matching cities"],
"Не нашли «{}». Проверьте написание или отметьте точку на карте":["Nu am găsit «{}». Verificați scrierea sau marcați punctul pe hartă","Couldn't find “{}”. Check the spelling or mark the point on the map"],
"Все":["Toate","All"],"Любой город":["Orice oraș","Any city"],"Любой транспорт":["Orice transport","Any transport"],
"Моя цена до, €":["Prețul meu până la, €","My max price, €"],"Моя цена за место до, €":["Prețul meu pe loc până la, €","My max price per seat, €"],
"Моя цена за кг до, €":["Prețul meu pe kg până la, €","My max price per kg, €"],"Моя цена за авто до, €":["Prețul meu pe auto până la, €","My max price per car, €"],
"Моя цена за перегон до, €":["Prețul meu pe transfer până la, €","My max price per delivery, €"],
"Что такое gotransfer":["Ce este gotransfer","What is gotransfer"],"Приблизить":["Mărește","Zoom in"],"Отдалить":["Micșorează","Zoom out"],
"Вид транспорта":["Tip de transport","Type of transport"],"любая":["oricare","any"],
"Попутки, посылки или, может быть, свободный трал?":["Ocazii, colete sau poate o platformă auto liberă?","Rides, parcels, or maybe a free car carrier?"],
"Передайте посылку, найдите попутчиков или пассажиров, перевозчика для машины, свободный трал, место в автобусе или маршрутке. У компаний и у частных водителей.":["Trimiteți un colet, găsiți colegi de drum sau pasageri, un transportator pentru mașină, o platformă liberă, un loc în autobuz sau microbuz. La companii și la șoferi privați.","Send a parcel, find travel companions or passengers, a car transporter, a free car carrier, a seat on a bus or minibus. From companies and private drivers."],
"Я еду, могу взять":["Plec, pot lua","I'm going, I can take"],"Хочу отправить или доехать":["Vreau să trimit sau să ajung","I want to send or travel"],
"Отправление":["Plecare","Departure"],"Прибытие":["Sosire","Arrival"],"Ждут транспорт":["Așteaptă transport","Waiting for transport"],
"Цифра: сколько поездок или людей":["Cifra: câte curse sau persoane","Number: how many trips or people"],
"{} Линии показывают, кто откуда куда едет. Нажмите на поездку, чтобы увидеть точный маршрут.":["{} Liniile arată cine de unde și unde merge. Apăsați pe o cursă ca să vedeți ruta exactă.","{} Lines show who is going where. Tap a trip to see the exact route."],
"Линии показывают, кто откуда куда едет. Нажмите на поездку, чтобы увидеть точный маршрут.":["Liniile arată cine de unde și unde merge. Apăsați pe o cursă ca să vedeți ruta exactă.","Lines show who is going where. Tap a trip to see the exact route."],
"Откуда":["De unde","From"],"Куда":["Unde","To"],"Сбросить":["Resetează","Reset"],
"Не нашли транспорт? Поставить точку ожидания":["Nu ați găsit transport? Puneți un punct de așteptare","No transport found? Set a waiting point"],
"Цены ориентировочные. Окончательную цену вы согласуете с водителем во внутреннем чате.":["Prețurile sunt orientative. Prețul final îl stabiliți cu șoferul în chatul intern.","Prices are approximate. You agree on the final price with the driver in the in-app chat."],
"А · {}":["A · {}","A · {}"],"Б · {}":["B · {}","B · {}"],
"Нажмите на карту: откуда едете или отправляете":["Apăsați pe hartă: de unde plecați sau trimiteți","Tap the map: where you're leaving or sending from"],
"Нажмите на карту: куда":["Apăsați pe hartă: unde","Tap the map: where to"],"Нажмите на любую цветную точку":["Apăsați pe orice punct colorat","Tap any coloured dot"],
"Ближайшие отправления: {}":["Cele mai apropiate plecări: {}","Upcoming departures: {}"],"Ближайшие отправления":["Cele mai apropiate plecări","Upcoming departures"],
"Нет подходящих отправлений":["Nu sunt plecări potrivite","No matching departures"],
"По этому направлению пока никто не едет. Попробуйте другой город рядом или включите «Все» типы.":["Deocamdată nimeni nu merge în această direcție. Încercați alt oraș din apropiere sau alegeți «Toate» tipurile.","Nobody is going this way yet. Try a nearby city or choose “All” types."],
"Фото транспорта: {}":["Foto transport: {}","Vehicle photo: {}"],"Ваш маршрут, ждите сообщений":["Ruta dvs., așteptați mesaje","Your route, wait for messages"],
"Написать в чат":["Scrie în chat","Message in chat"],"Забронировать":["Rezervă","Book"],"← Все поездки":["← Toate cursele","← All trips"],
"≈{} км":["≈{} km","≈{} km"],"· ≈{} км":["· ≈{} km","· ≈{} km"],"Строим маршрут по дорогам…":["Construim ruta pe drumuri…","Building the road route…"],
"Кто везёт":["Cine transportă","Who's driving"],"Маршрут А → Б":["Ruta A → B","Route A → B"],
"По дорогам: {} км, в пути ≈{} ч":["Pe drumuri: {} km, pe drum ≈{} h","By road: {} km, travel time ≈{} h"],"{} км по дорогам":["{} km pe drumuri","{} km by road"],
"Маршрут по дорогам сейчас не построить, линия показана напрямую":["Ruta pe drumuri nu se poate construi acum, linia e arătată direct","Can't build a road route right now, showing a straight line"],
"Маршрут по дорогам сейчас не построить, попробуйте позже":["Ruta pe drumuri nu se poate construi acum, încercați mai târziu","Can't build a road route right now, please try later"],
"{} своб. мест":["{} locuri libere","{} free seats"],"нет поездок":["nu sunt curse","no trips"],
"Отсюда пока никто не выезжает.":["Deocamdată nimeni nu pleacă de aici.","Nobody is leaving from here yet."],"Сюда пока никто не едет.":["Deocamdată nimeni nu vine aici.","Nobody is coming here yet."],
"Попробуйте соседний город или опубликуйте свой маршрут.":["Încercați un oraș vecin sau publicați ruta dvs.","Try a nearby city or post your own route."],
"Выезжают отсюда":["Pleacă de aici","Leaving from here"],"Едут сюда":["Vin aici","Coming here"],"Искать отсюда":["Caută de aici","Search from here"],"Искать сюда":["Caută până aici","Search to here"],
"{} (вы)":["{} (dvs.)","{} (you)"],"{} чел.":["{} pers.","{} people"],", {} чел.":[", {} pers.",", {} people"],"{} чел. · {} запр.":["{} pers. · {} cereri","{} people · {} requests"],
"Я еду в {}: опубликовать маршрут":["Merg la {}: publică ruta","I'm going to {}: post a route"],"Здесь пока никто не ждёт.":["Aici deocamdată nu așteaptă nimeni.","Nobody is waiting here yet."],
"Ждут транспорт из {}":["Așteaptă transport din {}","Waiting for transport from {}"],
"Эти люди не нашли попутку. Едете в ту же сторону? Напишите им и договоритесь о цене.":["Acești oameni nu au găsit ocazie. Mergeți în aceeași direcție? Scrieți-le și stabiliți prețul.","These people haven't found a ride. Going the same way? Message them and agree on a price."],
"Точка ожидания убрана":["Punctul de așteptare a fost eliminat","Waiting point removed"],"Сначала укажите вверху «Откуда» и «Куда»":["Mai întâi indicați sus «De unde» și «Unde»","First fill in “From” and “To” at the top"],
"Например: багаж 1 чемодан":["De exemplu: bagaj 1 valiză","For example: luggage, 1 suitcase"],"Поставить точку ожидания":["Pune un punct de așteptare","Set a waiting point"],
"На карте загорится мигающая оранжевая точка. Водители, которые едут в эту сторону, увидят её и напишут вам.":["Pe hartă va apărea un punct portocaliu care clipește. Șoferii care merg în această direcție îl vor vedea și vă vor scrie.","A blinking orange dot will appear on the map. Drivers going this way will see it and message you."],
"Маршрут":["Ruta","Route"],"Что нужно":["Ce trebuie","What you need"],"Когда":["Când","When"],"Сколько человек":["Câte persoane","How many people"],"Комментарий":["Comentariu","Comment"],
"Поставить точку":["Pune punctul","Set point"],"Проверьте дату":["Verificați data","Check the date"],
"Точка ожидания поставлена. Водители увидят её на карте":["Punctul de așteptare a fost pus. Șoferii îl vor vedea pe hartă","Waiting point set. Drivers will see it on the map"],
"Ищет: {} → {}":["Caută: {} → {}","Looking for: {} → {}"],
"Здравствуйте! Я еду {} → {} {}. Могу взять вас. Обсудим цену?":["Bună ziua! Merg {} → {} {}. Vă pot lua. Discutăm prețul?","Hello! I'm going {} → {} {}. I can take you. Shall we discuss the price?"],
"Здравствуйте! Я еду {} → {} {}. Могу взять. Обсудим цену?":["Bună ziua! Merg {} → {} {}. Pot să-l iau. Discutăm prețul?","Hello! I'm going {} → {} {}. I can take it. Shall we discuss the price?"],
"{}: {} {} · от {} € {}":["{1}: {2} {3} · de la {4} € {5}","{1}: {2} {3} · from {4} € {5}"],"{}: {} {} · от {} {}":["{}: {} {} · de la {} {}","{}: {} {} · from {} {}"],"Отправление: {}, {}, в {}":["Plecare: {}, {}, la {}","Departure: {}, {}, at {}"],
"Сколько мест":["Câte locuri","How many seats"],"Вес посылки, кг":["Greutatea coletului, kg","Parcel weight, kg"],"Сколько машин пригнать":["Câte mașini de adus","How many cars to deliver"],
"Сколько машин":["Câte mașini","How many cars"],"впишите вес":["scrieți greutatea","enter weight"],"Какую машину пригнать":["Ce mașină trebuie adusă","Which car to deliver"],"Какая машина":["Ce mașină","Which car"],
"Например: Audi A4, 2019, на ходу":["De exemplu: Audi A4, 2019, în stare de mers","For example: Audi A4, 2019, runs"],
"Для перегона понадобятся доверенность на водителя, страховка Green Card и документы на машину.":["Pentru transfer e nevoie de procură pe numele șoferului, asigurare Green Card și actele mașinii.","For a car delivery you'll need a power of attorney for the driver, Green Card insurance and the car's documents."],
"Водителю, ориентировочно":["Șoferului, orientativ","To the driver, approximately"],"Бронь в приложении":["Rezervarea în aplicație","Booking in the app"],"бесплатно":["gratuit","free"],
"Точную цену вы согласуете с водителем в чате и платите ему напрямую.":["Prețul exact îl stabiliți cu șoferul în chat și îi plătiți direct.","You agree on the exact price with the driver in chat and pay them directly."],
"Впишите вес посылки":["Scrieți greutatea coletului","Enter the parcel weight"],"Впишите количество":["Scrieți cantitatea","Enter the quantity"],
"Забронировано. Водитель получил сообщение в чате":["Rezervat. Șoferul a primit mesaj în chat","Booked. The driver got a message in chat"],
"Бронь подтверждена: {}, {} {}. Напишите, где удобно встретиться.":["Rezervare confirmată: {}, {} {}. Scrieți unde vă e comod să ne întâlnim.","Booking confirmed: {}, {} {}. Write where it's convenient to meet."],
"Забронировано. Водитель написал вам в чат":["Rezervat. Șoferul v-a scris în chat","Booked. The driver has messaged you in chat"],
"Здравствуйте! Хочу передать посылку из {} в {}. Примерно 5 кг. Когда и где можно отдать?":["Bună ziua! Vreau să trimit un colet din {} în {}. Aproximativ 5 kg. Când și unde îl pot preda?","Hello! I'd like to send a parcel from {} to {}. About 5 kg. When and where can I hand it over?"],
"Здравствуйте! Я купил машину в {}, нужно пригнать её в {}. Машина оплачена, документы готовы. Сколько возьмёте за перегон?":["Bună ziua! Am cumpărat o mașină în {}, trebuie adusă în {}. Mașina e plătită, actele sunt gata. Cât luați pentru transfer?","Hello! I bought a car in {} and need it driven to {}. It's paid for and the documents are ready. How much do you charge for the delivery?"],
"Здравствуйте! Нужно перевезти машину из {} в {}. Есть место на трале?":["Bună ziua! Trebuie să transport o mașină din {} în {}. Aveți loc pe platformă?","Hello! I need to transport a car from {} to {}. Is there room on the carrier?"],
"Здравствуйте! Есть свободное место до {}? Откуда забираете?":["Bună ziua! Aveți un loc liber până la {}? De unde luați?","Hello! Is there a free seat to {}? Where do you pick up?"],
/* Чаты */
"Вы: {}":["Dvs.: {}","You: {}"],"Вы:":["Dvs.:","You:"],"Новый чат":["Chat nou","New chat"],
"Здесь будут переписки с водителями и перевозчиками. Найдите маршрут на карте и нажмите «Написать».":["Aici vor fi conversațiile cu șoferii și transportatorii. Găsiți o rută pe hartă și apăsați «Scrie».","Your conversations with drivers and carriers will be here. Find a route on the map and tap “Message”."],
"Чаты":["Chaturi","Chats"],"Напишите водителю: что везёте, откуда забрать, когда удобно. Номер телефона покажем после брони.":["Scrieți șoferului: ce trimiteți, de unde să ia, când vă convine. Numărul de telefon îl arătăm după rezervare.","Tell the driver what you're sending, where to pick it up and when suits you. We'll show the phone number after booking."],
"Забронировать в этом маршруте":["Rezervă pe această rută","Book on this route"],"← Чаты":["← Chaturi","← Chats"],
/* Подача объявления */
"Нажмите на карту":["Apăsați pe hartă","Tap the map"],"Нажмите точку отправления":["Apăsați punctul de plecare","Tap the departure point"],"Нажмите точку прибытия":["Apăsați punctul de sosire","Tap the arrival point"],
"Приблизьте и нажмите точное место встречи":["Măriți și apăsați locul exact de întâlnire","Zoom in and tap the exact meeting place"],"Маршрут отмечен":["Ruta marcată","Route marked"],
"Изменить точку на карте":["Schimbă punctul pe hartă","Change the point on the map"],"Отметить точное место на карте":["Marchează locul exact pe hartă","Mark the exact place on the map"],
"Место встречи отмечено:":["Locul de întâlnire marcat:","Meeting place marked:"],"Пассажиры увидят точку на карте и придут прямо к ней.":["Pasagerii vor vedea punctul pe hartă și vor veni direct acolo.","Passengers will see the point on the map and come straight to it."],
"Фото вашего транспорта":["Foto transportului dvs.","Photo of your vehicle"],"Заменить фото":["Schimbă foto","Replace photo"],"Загрузить фото транспорта":["Încarcă foto transportului","Upload a vehicle photo"],
"Рейс":["Cursă","Trip"],"Транспорт":["Transport","Vehicle"],"пока бесплатно":["deocamdată gratuit","free for now"],
"Плата {} за объявление начнёт действовать, когда подключим оплату картой.":["Taxa de {} pentru anunț va intra în vigoare când vom conecta plata cu cardul.","The {} listing fee will apply once card payments are connected."],
"Опубликовать бесплатно":["Publică gratuit","Post for free"],"Опубликовать":["Publică","Post"],"Оплатить {} и опубликовать":["Plătește {} și publică","Pay {} and post"],
"Например: Кишинёв":["De exemplu: Chișinău","For example: Chișinău"],"ул. Измаил, 33":["str. Ismail, 33","33 Ismail St."],"сколько":["câte","how many"],"впишите цену":["scrieți prețul","enter price"],
"сколько кг":["câte kg","how many kg"],"Например: остановки в Яссах и Вене":["De exemplu: opriri la Iași și Viena","For example: stops in Iași and Vienna"],
"Отметьте на карте, откуда выезжаете и куда едете. Пассажиры и отправители увидят маршрут и напишут вам.":["Marcați pe hartă de unde plecați și unde mergeți. Pasagerii și expeditorii vor vedea ruta și vă vor scrie.","Mark on the map where you're leaving from and where you're going. Passengers and senders will see the route and message you."],
"Когда и откуда выезжаете":["Când și de unde plecați","When and where you leave from"],"Дата":["Data","Date"],"Время выезда":["Ora plecării","Departure time"],"Город":["Oraș","City"],"Улица и дом":["Strada și numărul","Street and number"],
"На чём едете":["Cu ce mergeți","What are you travelling in"],"Без транспорта, пригоню чужую машину":["Fără transport, aduc mașina altcuiva","No vehicle, I'll drive someone else's car"],
"Что можете взять и за сколько. Заполните только то, что берёте, и впишите свою цену. Пустые строки не публикуются.":["Ce puteți lua și cu cât. Completați doar ce luați și scrieți prețul dvs. Rândurile goale nu se publică.","What you can take and for how much. Fill in only what you take and enter your price. Empty rows aren't posted."],
"Свободных мест":["Locuri libere","Free seats"],"Ваша цена за место, €":["Prețul dvs. pe loc, €","Your price per seat, €"],"Посылки, до кг":["Colete, până la kg","Parcels, up to kg"],
"Ваша цена за кг, €":["Prețul dvs. pe kg, €","Your price per kg, €"],"Места на трале, авто":["Locuri pe platformă, auto","Carrier spaces, cars"],"Ваша цена за авто, €":["Prețul dvs. pe auto, €","Your price per car, €"],
"Перегон: пригоню авто":["Transfer: aduc mașina","Car delivery: I'll drive a car"],"Ваша цена за перегон, €":["Prețul dvs. pe transfer, €","Your price per delivery, €"],
"Подача объявления":["Publicarea anunțului","Posting a listing"],"Нажмите «Откуда» или «Куда», чтобы поменять точку":["Apăsați «De unde» sau «Unde» ca să schimbați punctul","Tap “From” or “To” to change the point"],
"Место встречи":["Locul de întâlnire","Meeting place"],"Выберите файл с фотографией":["Alegeți un fișier cu fotografie","Choose a photo file"],
"Фото слишком большое, нужно до 15 МБ":["Foto e prea mare, trebuie până la 15 MB","The photo is too large, it must be under 15 MB"],"Фото добавлено":["Foto adăugată","Photo added"],
"Не получилось открыть фото, попробуйте другое":["Nu s-a putut deschide foto, încercați alta","Couldn't open the photo, try another one"],"Сначала выберите, откуда выезжаете":["Mai întâi alegeți de unde plecați","First choose where you're leaving from"],
"Отметьте на карте обе точки: откуда и куда":["Marcați pe hartă ambele puncte: de unde și unde","Mark both points on the map: from and to"],
"Впишите цену за место":["Scrieți prețul pe loc","Enter the price per seat"],"Укажите, сколько свободных мест":["Indicați câte locuri libere","Enter how many free seats"],
"Впишите цену за кг":["Scrieți prețul pe kg","Enter the price per kg"],"Укажите, сколько кг посылок возьмёте":["Indicați câte kg de colete luați","Enter how many kg of parcels you'll take"],
"Впишите цену за авто на трале":["Scrieți prețul pe auto pe platformă","Enter the price per car on the carrier"],"Укажите, сколько авто возьмёте на трал":["Indicați câte mașini luați pe platformă","Enter how many cars you'll take on the carrier"],
"Впишите цену за перегон":["Scrieți prețul pe transfer","Enter the price per delivery"],"Укажите, сколько авто пригоните":["Indicați câte mașini aduceți","Enter how many cars you'll deliver"],
"Проверьте число: слишком большое значение":["Verificați numărul: valoare prea mare","Check the number: the value is too large"],"Проверьте цену: слишком большое значение":["Verificați prețul: valoare prea mare","Check the price: the value is too large"],
"Укажите, что можете взять, и впишите свою цену":["Indicați ce puteți lua și scrieți prețul dvs.","Say what you can take and enter your price"],"Проверьте дату и время выезда":["Verificați data și ora plecării","Check the departure date and time"],
"Маршрут опубликован. Ждите сообщений от пассажиров":["Ruta a fost publicată. Așteptați mesaje de la pasageri","Route posted. Wait for messages from passengers"],
/* Профиль */
"Ваше фото":["Foto dvs.","Your photo"],"Номер телефона подтверждён":["Numărul de telefon confirmat","Phone number confirmed"],"Почта подтверждена":["E-mail confirmat","Email confirmed"],
"Номер телефона не подтверждён":["Numărul de telefon nu e confirmat","Phone number not confirmed"],"Telegram подключён: коды для входа приходят туда":["Telegram conectat: codurile de intrare vin acolo","Telegram connected: login codes are sent there"],
"Telegram не подключён":["Telegram nu e conectat","Telegram not connected"],"Подключить":["Conectează","Connect"],"Заменить":["Schimbă","Replace"],"Добавить":["Adaugă","Add"],
"Документы проверены":["Acte verificate","Documents verified"],"Документы не проверены":["Acte neverificate","Documents not verified"],"Пройти проверку":["Treci verificarea","Get verified"],
"Телефон":["Telefon","Phone"],"Телефон {}":["Telefon {}","Phone {}"],
"Номер увидит только тот, с кем у вас бронь. Подтвердить номер можно, подключив Telegram.":["Numărul îl vede doar persoana cu care aveți rezervare. Puteți confirma numărul conectând Telegram.","Only the person you have a booking with can see the number. You can confirm it by connecting Telegram."],
"Например: Trans Nord SRL":["De exemplu: Trans Nord SRL","For example: Trans Nord SRL"],"13 цифр":["13 cifre","13 digits"],
"Для перевозчиков, автобусов и маршруток. Рядом с названием появится значок «Компания», а контакты увидят все пассажиры.":["Pentru transportatori, autobuze și microbuze. Lângă nume va apărea insigna «Companie», iar contactele le vor vedea toți pasagerii.","For carriers, buses and minibuses. A “Company” badge will appear next to the name and all passengers will see the contacts."],
"Название компании":["Denumirea companiei","Company name"],"Регистрационный номер (IDNO)":["Număr de înregistrare (IDNO)","Registration number (IDNO)"],"Второй телефон":["Al doilea telefon","Second phone"],"Факс":["Fax","Fax"],
"Регистрация, поиск, чат и бронь":["Înregistrare, căutare, chat și rezervare","Sign-up, search, chat and booking"],"Подача объявления (маршрута)":["Publicarea anunțului (rutei)","Posting a listing (route)"],
"Регистрация, поиск, чат, бронь и подача объявлений":["Înregistrare, căutare, chat, rezervare și publicarea anunțurilor","Sign-up, search, chat, booking and posting listings"],
"у вас забронировал(а) {}":["a rezervat la dvs.: {}","booked with you: {}"],"Показать телефон":["Arată telefonul","Show phone"],"Отзыв оставлен":["Recenzie lăsată","Review left"],"Оставить отзыв":["Lasă o recenzie","Leave a review"],
"Пока нет броней. Найдите маршрут на карте и нажмите «Забронировать».":["Deocamdată nu aveți rezervări. Găsiți o rută pe hartă și apăsați «Rezervă».","No bookings yet. Find a route on the map and tap “Book”."],
"Снять":["Retrage","Remove"],"Едете сами? Опубликуйте маршрут во вкладке «Я еду».":["Mergeți singur? Publicați ruta în fila «Eu plec».","Driving yourself? Post your route in the “I'm going” tab."],
"Не нашли транспорт? На карте нажмите «Поставить точку ожидания».":["Nu ați găsit transport? Pe hartă apăsați «Pune un punct de așteptare».","No transport found? On the map tap “Set a waiting point”."],
"Админка":["Admin","Admin"],"Кто пользуется приложением, какие экраны открывают и куда нажимают.":["Cine folosește aplicația, ce ecrane deschid și unde apasă.","Who uses the app, which screens they open and what they tap."],"Открыть админку":["Deschide admin","Open admin"],
"Запись включена: мы видим, какие экраны вы открываете и какие кнопки нажимаете. Текст сообщений, коды и то, что вы печатаете, не записываются.":["Înregistrarea e activată: vedem ce ecrane deschideți și ce butoane apăsați. Textul mesajelor, codurile și ce scrieți nu se înregistrează.","Recording is on: we see which screens you open and which buttons you tap. Message text, codes and anything you type are not recorded."],
"Запись выключена. Если включите, нам будет проще находить ошибки и делать приложение удобнее.":["Înregistrarea e dezactivată. Dacă o activați, ne va fi mai ușor să găsim erori și să facem aplicația mai comodă.","Recording is off. If you turn it on, it will be easier for us to find bugs and improve the app."],
"Включить запись":["Activează înregistrarea","Turn on recording"],"Выйти на всех устройствах":["Ieși de pe toate dispozitivele","Sign out on all devices"],"Удалить аккаунт и все данные":["Șterge contul și toate datele","Delete account and all data"],
"Сбросить демо-данные":["Resetează datele demo","Reset demo data"],"https://instagram.com/ваш_ник":["https://instagram.com/numele_dvs","https://instagram.com/your_name"],"https://facebook.com/ваша_страница":["https://facebook.com/pagina_dvs","https://facebook.com/your_page"],
"Мой профиль":["Profilul meu","My profile"],"Мой профиль {}":["Profilul meu {}","My profile {}"],"Фото профиля":["Foto de profil","Profile photo"],"Кто вы":["Cine sunteți","Who you are"],"Физическое лицо":["Persoană fizică","Individual"],"Юридическое лицо":["Persoană juridică","Company"],
"Добавьте ссылки на свои страницы, чтобы попутчики могли узнать вас до поездки.":["Adăugați linkuri spre paginile dvs., ca tovarășii de drum să vă cunoască înainte de călătorie.","Add links to your pages so travel companions can get to know you before the trip."],
"Как меня видят":["Cum mă văd alții","How others see me"],"Сколько стоит":["Cât costă","Pricing"],"Без подписок и комиссий. Цену поездки вы согласуете с водителем в чате.":["Fără abonamente și comisioane. Prețul călătoriei îl stabiliți cu șoferul în chat.","No subscriptions or commissions. You agree on the trip price with the driver in chat."],
"Мои брони":["Rezervările mele","My bookings"],"Мои маршруты":["Rutele mele","My routes"],"Мои точки ожидания":["Punctele mele de așteptare","My waiting points"],"Как пользоваться приложением":["Cum se folosește aplicația","How to use the app"],"Выйти":["Ieșire","Sign out"],
"Ссылка Instagram должна начинаться с https://instagram.com/":["Linkul Instagram trebuie să înceapă cu https://instagram.com/","The Instagram link must start with https://instagram.com/"],
"Ссылка Facebook должна начинаться с https://facebook.com/":["Linkul Facebook trebuie să înceapă cu https://facebook.com/","The Facebook link must start with https://facebook.com/"],
"Укажите название компании":["Indicați denumirea companiei","Enter the company name"],"Проверьте e-mail: в нём должны быть @ и точка":["Verificați e-mailul: trebuie să conțină @ și punct","Check the email: it must contain @ and a dot"],
"Отлично! Ваш профиль изменён!":["Excelent! Profilul dvs. a fost modificat!","Great! Your profile has been updated!"],"Теперь попутчики увидят обновлённые данные.":["Acum tovarășii de drum vor vedea datele actualizate.","Travel companions will now see the updated details."],
"Фото профиля добавлено":["Foto de profil adăugată","Profile photo added"],"Номер не указан":["Numărul nu e indicat","No number given"],"Маршрут снят":["Ruta a fost retrasă","Route removed"],"Вы вышли на всех устройствах":["Ați ieșit de pe toate dispozitivele","You've been signed out on all devices"],
"Удалить аккаунт?":["Ștergeți contul?","Delete account?"],"Удалятся ваш профиль, маршруты, точки ожидания, брони и переписка. Вернуть их будет нельзя.":["Se vor șterge profilul, rutele, punctele de așteptare, rezervările și mesajele dvs. Nu vor putea fi recuperate.","Your profile, routes, waiting points, bookings and messages will be deleted. They can't be restored."],
"Да, удалить навсегда":["Da, șterge definitiv","Yes, delete forever"],"Аккаунт и все данные удалены":["Contul și toate datele au fost șterse","Account and all data deleted"],"Демо-данные сброшены":["Datele demo au fost resetate","Demo data reset"],
"Язык":["Limba","Language"],"Язык приложения":["Limba aplicației","App language"],
/* Знакомство и поддержка */
"Карта поездок":["Harta curselor","Trip map"],
"Зелёная точка: отсюда выезжают. Красная: сюда приезжают. Цифра показывает, сколько поездок. Нажмите на точку и увидите, кто едет и когда.":["Punct verde: de aici se pleacă. Roșu: aici se ajunge. Cifra arată câte curse sunt. Apăsați pe punct și vedeți cine merge și când.","Green dot: trips leave from here. Red: trips arrive here. The number shows how many trips. Tap a dot to see who's going and when."],
"Что можно сделать":["Ce puteți face","What you can do"],
"Поехать попутчиком, передать посылку, перевезти машину на трале или найти человека, который сам пригонит вашу купленную машину.":["Să mergeți cu ocazia, să trimiteți un colet, să transportați o mașină pe platformă sau să găsiți pe cineva care să vă aducă mașina cumpărată.","Get a ride, send a parcel, move a car on a carrier, or find someone to drive home the car you bought."],
"Договоритесь в чате":["Înțelegeți-vă în chat","Agree in chat"],"Нашли водителя? Нажмите «Написать» и договоритесь о цене и месте встречи. Потом нажмите «Забронировать».":["Ați găsit un șofer? Apăsați «Scrie» și stabiliți prețul și locul de întâlnire. Apoi apăsați «Rezervă».","Found a driver? Tap “Message” and agree on the price and meeting place. Then tap “Book”."],
"Никого не нашли?":["Nu ați găsit pe nimeni?","Didn't find anyone?"],"Поставьте оранжевую точку ожидания. Она мигает на карте, и водители, которые едут в вашу сторону, сами вам напишут.":["Puneți un punct portocaliu de așteptare. El clipește pe hartă, iar șoferii care merg în direcția dvs. vă vor scrie singuri.","Set an orange waiting point. It blinks on the map, and drivers going your way will message you."],
"Я еду":["Eu plec","I'm going"],"Едете сами?":["Mergeți singur?","Driving yourself?"],
"Во вкладке «Я еду» отметьте на карте, откуда и куда едете. Возьмите попутчиков или посылки и заработайте на дороге.":["În fila «Eu plec» marcați pe hartă de unde și unde mergeți. Luați pasageri sau colete și câștigați pe drum.","In the “I'm going” tab, mark on the map where you're going from and to. Take passengers or parcels and earn on the way."],
"Пропустить":["Sari peste","Skip"],"Я всё понял":["Am înțeles tot","Got it all"],"Далее":["Mai departe","Next"],"Как пользоваться":["Cum se folosește","How to use"],"Шаг {} из {}":["Pasul {} din {}","Step {} of {}"],
"Отлично! Если забудете, нажмите «?» вверху":["Excelent! Dacă uitați, apăsați «?» sus","Great! If you forget, tap “?” at the top"],
"Если никто не едет, откройте «Карта», укажите «Откуда» и «Куда» и нажмите «Не нашли транспорт? Поставить точку ожидания». На карте появится мигающая оранжевая точка, и водители вам напишут.":["Dacă nimeni nu merge, deschideți «Harta», indicați «De unde» și «Unde» și apăsați «Nu ați găsit transport? Puneți un punct de așteptare». Pe hartă va apărea un punct portocaliu care clipește, iar șoferii vă vor scrie.","If nobody is going, open “Map”, fill in “From” and “To” and tap “No transport found? Set a waiting point”. A blinking orange dot will appear on the map, and drivers will message you."],
"Зелёные точки показывают, откуда выезжают, красные показывают, куда приезжают. Цифра в точке: сколько поездок. Нажмите на точку, и откроется список водителей.":["Punctele verzi arată de unde se pleacă, cele roșii unde se ajunge. Cifra din punct: câte curse sunt. Apăsați pe punct și se deschide lista șoferilor.","Green dots show where trips leave from, red ones where they arrive. The number in a dot is how many trips. Tap a dot to open the list of drivers."],
"Чтобы отправить посылку, на карте выберите «Посылки», укажите свой город и город получателя. Нажмите «Написать» у ближайшего водителя и договоритесь, где передать коробку.":["Ca să trimiteți un colet, pe hartă alegeți «Colete», indicați orașul dvs. și orașul destinatarului. Apăsați «Scrie» la cel mai apropiat șofer și stabiliți unde predați cutia.","To send a parcel, choose “Parcels” on the map and enter your city and the recipient's city. Tap “Message” on the nearest driver and agree where to hand over the box."],
"Купили машину за границей? Выберите «Перегон»: это люди, которые едут туда без своей машины и могут пригнать вашу. Понадобятся доверенность, страховка Green Card и документы на машину.":["Ați cumpărat o mașină în străinătate? Alegeți «Transfer auto»: sunt oameni care merg acolo fără mașină și o pot aduce pe a dvs. Veți avea nevoie de procură, asigurare Green Card și actele mașinii.","Bought a car abroad? Choose “Car delivery”: these are people travelling there without a car who can drive yours back. You'll need a power of attorney, Green Card insurance and the car's documents."],
"Выберите «Трал», чтобы найти перевозчика с автовозом или эвакуатором. Укажите, откуда забрать машину, и забронируйте место на погрузку.":["Alegeți «Platformă auto» ca să găsiți un transportator cu autotransportor sau platformă. Indicați de unde să ia mașina și rezervați locul la încărcare.","Choose “Car carrier” to find a carrier with a car transporter or tow truck. Say where to pick up the car and book a loading space."],
"Регистрация, поиск, чат и бронь бесплатные. Платная только подача объявления: {} за маршрут. Цену поездки вы согласуете с водителем в чате.":["Înregistrarea, căutarea, chatul și rezervarea sunt gratuite. Se plătește doar publicarea anunțului: {} pe rută. Prețul călătoriei îl stabiliți cu șoferul în chat.","Sign-up, search, chat and booking are free. Only posting a listing is paid: {} per route. You agree on the trip price with the driver in chat."],
"Всё бесплатно: регистрация, поиск, чат, бронь и подача объявлений. Цену поездки вы согласуете с водителем в чате.":["Totul e gratuit: înregistrarea, căutarea, chatul, rezervarea și publicarea anunțurilor. Prețul călătoriei îl stabiliți cu șoferul în chat.","Everything is free: sign-up, search, chat, booking and posting listings. You agree on the trip price with the driver in chat."],
"Если едете сами, откройте вкладку «Я еду», отметьте на карте откуда и куда, укажите свободные места, посылки или трал и нажмите «Опубликовать маршрут».":["Dacă mergeți singur, deschideți fila «Eu plec», marcați pe hartă de unde și unde, indicați locurile libere, coletele sau platforma și apăsați «Publică».","If you're driving yourself, open the “I'm going” tab, mark from and to on the map, enter free seats, parcels or carrier spaces and tap “Post”."],
"Нажмите «Забронировать» у поездки, выберите, что нужно, и подтвердите бронь, это бесплатно. Водитель сразу напишет вам в чат.":["Apăsați «Rezervă» la cursă, alegeți ce vă trebuie și confirmați rezervarea, e gratuit. Șoferul vă va scrie imediat în chat.","Tap “Book” on a trip, choose what you need and confirm the booking, it's free. The driver will message you in chat straight away."],
"Нажмите «Написать» у любой поездки или у оранжевой точки. Все переписки лежат во вкладке «Чаты».":["Apăsați «Scrie» la orice cursă sau la un punct portocaliu. Toate conversațiile sunt în fila «Chaturi».","Tap “Message” on any trip or orange dot. All conversations are in the “Chats” tab."],
"Чтобы найти попутку, на карте укажите «Откуда» и «Куда». Ниже появится список ближайших выездов. Нажмите «Написать», договоритесь о цене и забронируйте место.":["Ca să găsiți o ocazie, pe hartă indicați «De unde» și «Unde». Mai jos va apărea lista celor mai apropiate plecări. Apăsați «Scrie», stabiliți prețul și rezervați locul.","To find a ride, fill in “From” and “To” on the map. A list of upcoming departures will appear below. Tap “Message”, agree on a price and book a seat."],
"Как найти попутку?":["Cum găsesc o ocazie?","How do I find a ride?"],"Как отправить посылку?":["Cum trimit un colet?","How do I send a parcel?"],"Что такое перегон?":["Ce este transferul auto?","What is car delivery?"],
"Что значит оранжевая точка?":["Ce înseamnă punctul portocaliu?","What does the orange dot mean?"],"Сколько это стоит?":["Cât costă?","How much does it cost?"],
"Спасибо за вопрос! Я передам его оператору, он ответит здесь в течение дня. А пока можно ещё раз посмотреть короткое ознакомление: кнопка «?» вверху экрана.":["Mulțumim pentru întrebare! O transmit operatorului, el va răspunde aici în decurs de o zi. Între timp puteți revedea scurta prezentare: butonul «?» din partea de sus.","Thanks for your question! I'll pass it to an operator, who will reply here within a day. Meanwhile you can watch the short intro again: the “?” button at the top of the screen."],
"Ваш вопрос":["Întrebarea dvs.","Your question"],"Поддержка gotransfer":["Suport gotransfer","gotransfer support"],"Спросите, как пользоваться приложением":["Întrebați cum se folosește aplicația","Ask how to use the app"],
"Здравствуйте! Я помогу разобраться с приложением. Выберите вопрос или напишите свой.":["Bună ziua! Vă ajut să vă descurcați cu aplicația. Alegeți o întrebare sau scrieți-o pe a dvs.","Hello! I'll help you find your way around the app. Choose a question or write your own."],
/* Люди, отзывы, проверка */
"Телефон и документы проверены":["Telefon și acte verificate","Phone and documents verified"],"Проверен":["Verificat","Verified"],"Компания":["Companie","Company"],"новичок":["nou","new"],
"Документы ещё не проверены":["Actele nu sunt încă verificate","Documents not verified yet"],"Есть ссылки на соцсети":["Are linkuri spre rețele sociale","Has social media links"],"Соцсети не указаны":["Rețele sociale neindicate","No social media"],
"Рег. номер (IDNO)":["Nr. înreg. (IDNO)","Reg. no. (IDNO)"],"Контакты компании":["Contactele companiei","Company contacts"],"Посмотреть страницу перед поездкой:":["Vedeți pagina înainte de călătorie:","Check the page before the trip:"],
"Пока нет отзывов.":["Deocamdată nu sunt recenzii.","No reviews yet."],"{} · {} поездок · в приложении с {} года":["{} · {} curse · în aplicație din {}","{} · {} trips · on the app since {}"],"Отзывы":["Recenzii","Reviews"],
"В демо ссылка ненастоящая. В рабочей версии откроется {} водителя":["În demo linkul nu e real. În versiunea reală se va deschide {} șoferului","In the demo the link isn't real. The live version opens the driver's {}"],
"{} из 5":["{} din 5","{} of 5"],"Оценка":["Nota","Rating"],"Например: приехал вовремя, помог с багажом":["De exemplu: a venit la timp, a ajutat cu bagajul","For example: arrived on time, helped with luggage"],
"Отзыв о поездке":["Recenzie despre călătorie","Trip review"],"{} · водитель {}. Отзыв увидят все, кто захочет поехать с этим водителем.":["{} · șofer {}. Recenzia o vor vedea toți cei care vor să meargă cu acest șofer.","{} · driver {}. Everyone who wants to travel with this driver will see the review."],
"Что понравилось или нет":["Ce v-a plăcut sau nu","What you liked or didn't"],"Отправить отзыв":["Trimite recenzia","Send review"],"Напишите пару слов о поездке":["Scrieți câteva cuvinte despre călătorie","Write a few words about the trip"],"Спасибо за отзыв!":["Mulțumim pentru recenzie!","Thanks for your review!"],
"Проверка документов скоро появится. Мы напишем, когда её можно будет пройти":["Verificarea actelor va apărea în curând. Vă vom scrie când o veți putea face","Document verification is coming soon. We'll let you know when it's available"],
"Проверка документов":["Verificarea actelor","Document verification"],
"Проверка займёт пару минут: сфотографируйте паспорт или права и сделайте селфи. Проверку проводит специальный сервис (например, Veriff или Sumsub), а мы получаем только ответ «проверен» или «нет». Сами документы мы не храним.":["Verificarea durează câteva minute: fotografiați pașaportul sau permisul și faceți un selfie. Verificarea o face un serviciu special (de exemplu, Veriff sau Sumsub), iar noi primim doar răspunsul «verificat» sau «nu». Actele nu le păstrăm.","Verification takes a couple of minutes: photograph your passport or driving licence and take a selfie. A dedicated service (such as Veriff or Sumsub) does the check, and we only get the answer “verified” or “not”. We don't store the documents."],
"После проверки рядом с вашим именем появится значок {}. Таким водителям и попутчикам доверяют больше.":["După verificare, lângă numele dvs. va apărea insigna {}. În astfel de șoferi și pasageri oamenii au mai multă încredere.","After verification a {} badge will appear next to your name. People trust such drivers and passengers more."],
"После проверки рядом с вашим именем появится значок":["După verificare, lângă numele dvs. va apărea insigna","After verification a badge will appear next to your name:"],
". Таким водителям и попутчикам доверяют больше.":[". În astfel de șoferi și pasageri oamenii au mai multă încredere.",". People trust such drivers and passengers more."],
"Пройти проверку (демо)":["Treci verificarea (demo)","Get verified (demo)"],"Готово! Теперь у вас значок «Проверен»":["Gata! Acum aveți insigna «Verificat»","Done! You now have the “Verified” badge"],
/* Поделиться */
"gotransfer: попутки, посылки и перевозка машин по Европе. Смотри на карте, кто едет в твою сторону, или бери попутчиков сам.":["gotransfer: ocazii, colete și transport de mașini prin Europa. Vezi pe hartă cine merge în direcția ta sau ia tu pasageri.","gotransfer: rides, parcels and car transport across Europe. See on the map who's going your way, or take passengers yourself."],
"Спасибо, вы нам помогли!":["Mulțumim, ne-ați ajutat!","Thank you, you've helped us!"],"Каждый, кто узнает о gotransfer от вас, быстрее найдёт попутку или водителя для посылки.":["Oricine află de gotransfer de la dvs. va găsi mai repede o ocazie sau un șofer pentru colet.","Everyone who hears about gotransfer from you will find a ride or a parcel driver faster."],
"Поделиться ещё раз":["Partajează din nou","Share again"],"Поделись один раз, помоги нам":["Partajează o dată, ajută-ne","Share once, help us out"],
"Чем больше людей в приложении, тем быстрее находится попутка, посылка уезжает в тот же день, а водители не едут с пустыми местами.":["Cu cât sunt mai mulți oameni în aplicație, cu atât mai repede se găsește o ocazie, coletul pleacă în aceeași zi, iar șoferii nu merg cu locuri goale.","The more people on the app, the faster rides are found, parcels leave the same day and drivers don't travel with empty seats."],
"Поделиться приложением":["Partajează aplicația","Share the app"],"Спасибо, что поделились!":["Mulțumim că ați partajat!","Thanks for sharing!"],"Одноклассники":["Odnoklassniki","Odnoklassniki"],"ВКонтакте":["VKontakte","VKontakte"],
"Ссылка на приложение":["Linkul aplicației","App link"],"Поделиться gotransfer":["Partajează gotransfer","Share gotransfer"],
"Выберите, где поделиться. Можно отправить другу или выложить у себя на странице.":["Alegeți unde să partajați. Puteți trimite unui prieten sau posta pe pagina dvs.","Choose where to share. You can send it to a friend or post it on your page."],
"Или скопируйте ссылку и вставьте куда угодно, например в Instagram:":["Sau copiați linkul și lipiți-l oriunde, de exemplu în Instagram:","Or copy the link and paste it anywhere, for example on Instagram:"],
"Копировать":["Copiază","Copy"],"Ссылка скопирована":["Link copiat","Link copied"],"Выделили ссылку, скопируйте её":["Am selectat linkul, copiați-l","The link is selected, copy it"],
/* Вкладки, клавиши, шапка */
"Карта":["Harta","Map"],"Профиль":["Profil","Profile"],"Клавиши":["Taste","Keys"],
"Не удалось загрузить карту. Проверьте интернет и обновите страницу.":["Nu s-a putut încărca harta. Verificați internetul și reîncărcați pagina.","Couldn't load the map. Check your internet and reload the page."],
"{} (клавиша {})":["{} (tasta {})","{} (key {})"],"Горячие клавиши":["Taste rapide","Keyboard shortcuts"],"Работают, когда курсор не стоит в поле ввода.":["Funcționează când cursorul nu e într-un câmp de text.","Work when the cursor isn't in a text field."],
"Найти город «Откуда»":["Caută orașul «De unde»","Find the “From” city"],"То же самое из любого места":["La fel, de oriunde","The same from anywhere"],"Приблизить или отдалить карту":["Mărește sau micșorează harta","Zoom the map in or out"],
"Закрыть окно":["Închide fereastra","Close window"],"Этот список":["Această listă","This list"],
"gotransfer: на главную":["gotransfer: pagina principală","gotransfer: home"],"На главную":["Pagina principală","Home"],"Установить приложение":["Instalează aplicația","Install the app"],
"Установить приложение на телефон или компьютер":["Instalează aplicația pe telefon sau calculator","Install the app on your phone or computer"],"Чат поддержки":["Chat de suport","Support chat"],"Задать вопрос":["Pune o întrebare","Ask a question"],
"Горячие клавиши (?)":["Taste rapide (?)","Keyboard shortcuts (?)"],"Установить":["Instalează","Install"],"Установить на iPhone":["Instalează pe iPhone","Install on iPhone"],
"Приложение появится на экране «Домой» с иконкой, как обычное. Бесплатно, без App Store.":["Aplicația va apărea pe ecranul principal cu o pictogramă, ca una obișnuită. Gratuit, fără App Store.","The app will appear on your Home Screen with an icon, like a regular app. Free, no App Store."],
"Нажмите кнопку «Поделиться»":["Apăsați butonul «Partajează»","Tap the “Share” button"],"внизу экрана (в Safari) или в адресной строке.":["în partea de jos a ecranului (în Safari) sau în bara de adrese.","at the bottom of the screen (in Safari) or in the address bar."],
"Прокрутите список вниз и выберите «На экран Домой»":["Derulați lista în jos și alegeți «Adaugă pe ecranul principal»","Scroll down the list and choose “Add to Home Screen”"],
"Нажмите «Добавить» в правом верхнем углу.":["Apăsați «Adaugă» în colțul din dreapta sus.","Tap “Add” in the top right corner."],"Установить на Mac":["Instalează pe Mac","Install on Mac"],
"В верхнем меню Safari откройте «Файл».":["În meniul de sus din Safari deschideți «Fișier».","In Safari's top menu open “File”."],"Выберите «Добавить в Dock».":["Alegeți «Adaugă în Dock».","Choose “Add to Dock”."],"Нажмите «Добавить».":["Apăsați «Adaugă».","Tap “Add”."],
"Откройте меню браузера (три точки ⋮).":["Deschideți meniul browserului (trei puncte ⋮).","Open the browser menu (three dots ⋮)."],
"Выберите «Установить приложение» или «Добавить на главный экран».":["Alegeți «Instalează aplicația» sau «Adaugă pe ecranul principal».","Choose “Install app” or “Add to Home screen”."],
/* Страны */
"Молдова":["Moldova","Moldova"],"Румыния":["România","Romania"],"Украина":["Ucraina","Ukraine"],"Италия":["Italia","Italy"],"Германия":["Germania","Germany"],"Франция":["Franța","France"],
"Испания":["Spania","Spain"],"Португалия":["Portugalia","Portugal"],"Великобритания":["Marea Britanie","United Kingdom"],"Ирландия":["Irlanda","Ireland"],"Бельгия":["Belgia","Belgium"],
"Нидерланды":["Țările de Jos","Netherlands"],"Люксембург":["Luxemburg","Luxembourg"],"Швейцария":["Elveția","Switzerland"],"Австрия":["Austria","Austria"],"Чехия":["Cehia","Czechia"],
"Словакия":["Slovacia","Slovakia"],"Польша":["Polonia","Poland"],"Венгрия":["Ungaria","Hungary"],"Болгария":["Bulgaria","Bulgaria"],"Греция":["Grecia","Greece"],"Турция":["Turcia","Turkey"],
"Сербия":["Serbia","Serbia"],"Хорватия":["Croația","Croatia"],"Словения":["Slovenia","Slovenia"],"Босния":["Bosnia","Bosnia"],"Черногория":["Muntenegru","Montenegro"],"Сев. Македония":["Macedonia de Nord","North Macedonia"],
"Албания":["Albania","Albania"],"Дания":["Danemarca","Denmark"],"Швеция":["Suedia","Sweden"],"Норвегия":["Norvegia","Norway"],"Финляндия":["Finlanda","Finland"],"Эстония":["Estonia","Estonia"],
"Латвия":["Letonia","Latvia"],"Литва":["Lituania","Lithuania"],"Беларусь":["Belarus","Belarus"],"Россия":["Rusia","Russia"],"Кипр":["Cipru","Cyprus"],"Мальта":["Malta","Malta"],
"Исландия":["Islanda","Iceland"],"Грузия":["Georgia","Georgia"],"Армения":["Armenia","Armenia"],"Азербайджан":["Azerbaidjan","Azerbaijan"],"Казахстан":["Kazahstan","Kazakhstan"]
};
/* Румынские названия городов, которых нет первыми в списке eucities.js */
const RO_CITY={"Вена":"Viena","Рим":"Roma","Милан":"Milano","Неаполь":"Napoli","Венеция":"Veneția","Турин":"Torino","Падуя":"Padova","Флоренция":"Florența","Генуя":"Genova",
  "Лондон":"Londra","Варшава":"Varșovia","Прага":"Praga","Будапешт":"Budapesta","Бухарест":"București","Москва":"Moscova","Афины":"Atena","Лиссабон":"Lisabona",
  "Мюнхен":"München","Кёльн":"Köln","Цюрих":"Zürich","Женева":"Geneva","Брюссель":"Bruxelles","Одесса":"Odesa","Киев":"Kiev","Стамбул":"Istanbul","Санкт-Петербург":"Sankt Petersburg",
  "Копенгаген":"Copenhaga","Стокгольм":"Stockholm","Гаага":"Haga","Севилья":"Sevilla","Белград":"Belgrad","Салоники":"Salonic","Краков":"Cracovia","Минск":"Minsk"};
const EN_CITY={"Кишинёв":"Chișinău","Бельцы":"Bălți","Яссы":"Iași","Кагул":"Cahul","Унгены":"Ungheni","Комрат":"Comrat","Сороки":"Soroca","Оргеев":"Orhei","Тирасполь":"Tiraspol","Бендеры":"Bender"};

const CY=/[А-Яа-яЁё]/;
const norm=s=>s.replace(/\s+/g," ").trim();
let EX=null,PAT=null,CITY=null;
function build(){
  EX=new Map();PAT=[];
  for(const k in D){const v=D[k][IX];const nk=norm(k);
    if(nk.includes("{}")){const parts=nk.split("{}").map(p=>p.replace(/[.*+?^$()|[\]\\]/g,"\\$&"));
      PAT.push({re:new RegExp("^"+parts.join("([\\s\\S]+?)")+"$"),out:v,n:parts.length-1,len:nk.length});
    }else EX.set(nk,v)}
  PAT.sort((a,b)=>b.len-a.len);
  CITY=new Map();
  (window.EU_CITIES||[]).forEach(c=>{if(!c||!c[0]||!CY.test(c[0]))return;const alt=String(c[1]||"").split("|")[0];
    const name=L==="ro"?(RO_CITY[c[0]]||EN_CITY[c[0]]||alt):(EN_CITY[c[0]]||alt);if(name)CITY.set(c[0],name)});
  for(const k in EN_CITY)if(!CITY.has(k))CITY.set(k,EN_CITY[k]);
  if(L==="ro")for(const k in RO_CITY)CITY.set(k,RO_CITY[k]);
}
function exact(s){if(EX.has(s))return EX.get(s);if(CITY.has(s))return CITY.get(s);
  const m=s.match(/^(.*?)([:.!?…]+)$/);if(m&&EX.has(m[1]))return EX.get(m[1])+m[2];return null}
function core(s,depth){
  let r=exact(s);if(r!=null)return r;
  if(depth<3)for(const p of PAT){const m=s.match(p.re);if(!m)continue;let i=0;
    return p.out.replace(/\{(\d*)\}/g,(_,d)=>{const g=m[d?+d:++i]||"";return CY.test(g)?tr(g,depth+1):g})}
  /* Несколько предложений подряд: переводим каждое */
  const sent=s.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z«])/);
  if(sent.length>1){const out=sent.map(x=>core(x,depth+1));if(out.every(x=>x!=null))return out.join(" ")}
  /* «Милан → Кишинёв», «Ищу место, 2 чел.»: переводим по кусочкам */
  const bits=s.split(/(\s*(?:→|·|—|–|\||,)\s*)/);
  if(bits.length>1){let ch=false;const out=bits.map((b,i)=>{if(i%2||!CY.test(b))return b;const t=core(norm(b),depth+1);if(t!=null){ch=true;return t}return b});if(ch)return out.join("")}
  return null;
}
function tr(s,depth){
  if(L==="ru"||!s||!CY.test(s))return s;
  if(!EX)build();
  const m=String(s).match(/^(\s*)([\s\S]*?)(\s*)$/);const r=core(norm(m[2]),depth||0);
  return r==null?s:m[1]+r+m[3];
}
/* Перевод страницы на лету */
const ATTRS=["placeholder","title","aria-label","alt"];
const skip=el=>!!(el&&el.closest&&el.closest('[translate="no"],script,style,textarea'));
function doText(n){if(!CY.test(n.data)||skip(n.parentNode))return;const t=tr(n.data);if(t!==n.data)n.data=t}
function doAttrs(el){if(skip(el))return;for(const a of ATTRS){const v=el.getAttribute(a);if(v&&CY.test(v)){const t=tr(v);if(t!==v)el.setAttribute(a,t)}}
  if(el.tagName==="INPUT"&&/^(button|submit)$/i.test(el.type)&&CY.test(el.value))el.value=tr(el.value)}
function walk(root){
  if(root.nodeType===3)return doText(root);if(root.nodeType!==1||skip(root))return;
  doAttrs(root);const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,null);let n;
  while((n=it.nextNode())){if(n.nodeType===3)doText(n);else doAttrs(n)}
}
function start(){
  mount();if(L==="ru")return;walk(document.documentElement);
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==="childList")m.addedNodes.forEach(walk);
    else if(m.type==="characterData")doText(m.target);
    else if(m.type==="attributes")doAttrs(m.target)}})
  .observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  const c=window.confirm.bind(window),a=window.alert.bind(window);
  window.confirm=s=>c(tr(String(s)));window.alert=s=>a(tr(String(s)));
}
function set(l){if(!SUP.includes(l)||l===L)return;try{localStorage.setItem(LS,JSON.stringify(l))}catch(e){}location.reload()}
/* Переключатель языка в шапке: видно «RU», а нажатие открывает родной список (на iPhone тоже). */
function picker(){
  const w=document.createElement("label");w.className="langbtn";w.setAttribute("translate","no");w.title=tr("Язык приложения");
  w.innerHTML='<span>'+L.toUpperCase()+'</span><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3"/></svg>';
  const s=document.createElement("select");s.setAttribute("aria-label",tr("Язык приложения"));
  [["ru","Русский"],["ro","Română"],["en","English"]].forEach(([v,full])=>{const o=document.createElement("option");o.value=v;o.textContent=full;o.selected=v===L;s.appendChild(o)});
  s.onchange=()=>set(s.value);w.appendChild(s);return w;
}
function mount(){const slot=document.getElementById("langslot");if(slot&&!slot.firstChild)slot.appendChild(picker())}
window.I18N={lang:L,loc:LOCALE[L],t:s=>tr(s),set,picker,city:n=>{if(L==="ru"||!n)return n;if(!EX)build();return CITY.get(n)||n}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
