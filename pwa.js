/* Установка приложения на экран телефона или компьютера (без Play Market и App Store) */
(function(){
  var btn=document.getElementById("installbtn");
  var deferred=null;
  var ua=navigator.userAgent;
  var standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  var ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  var macSafari=!ios&&/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);

  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
    addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});
  }
  if(standalone)return;

  function close(){var o=document.querySelector(".scrim.install");if(o)o.remove()}
  function show(html){
    close();
    var s=document.createElement("div");s.className="scrim install";
    s.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="insttitle">'+html+'<button class="btn" type="button" data-close>Понятно</button></div>';
    s.addEventListener("click",function(e){if(e.target===s||e.target.hasAttribute("data-close"))close()});
    document.body.appendChild(s);s.querySelector("[data-close]").focus();
  }
  var share='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
  var plus='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
  function iosHelp(){show(
    '<h2 id="insttitle">Установить на iPhone</h2>'+
    '<p class="muted small">Приложение появится на экране «Домой» с иконкой, как обычное. Бесплатно, без App Store.</p>'+
    '<ol class="steps">'+
    '<li>Нажмите кнопку «Поделиться» '+share+' внизу экрана (в Safari) или в адресной строке.</li>'+
    '<li>Прокрутите список вниз и выберите «На экран Домой» '+plus+'.</li>'+
    '<li>Нажмите «Добавить» в правом верхнем углу.</li>'+
    '</ol>'
  )}
  function macHelp(){show(
    '<h2 id="insttitle">Установить на Mac</h2>'+
    '<ol class="steps"><li>В верхнем меню Safari откройте «Файл».</li><li>Выберите «Добавить в Dock».</li><li>Нажмите «Добавить».</li></ol>'
  )}
  function otherHelp(){show(
    '<h2 id="insttitle">Установить приложение</h2>'+
    '<ol class="steps"><li>Откройте меню браузера (три точки ⋮).</li><li>Выберите «Установить приложение» или «Добавить на главный экран».</li></ol>'
  )}

  addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferred=e;btn.hidden=false});
  addEventListener("appinstalled",function(){deferred=null;btn.hidden=true;close()});
  if(ios||macSafari)btn.hidden=false;

  btn.addEventListener("click",function(){
    if(deferred){
      deferred.prompt();
      deferred.userChoice.then(function(r){if(r.outcome==="accepted")btn.hidden=true;deferred=null});
    }else if(ios)iosHelp();
    else if(macSafari)macHelp();
    else otherHelp();
  });
})();
