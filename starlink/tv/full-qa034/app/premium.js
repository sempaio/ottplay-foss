/* Theater 4 Premium: visual-only enhancement; does not intercept AVPlay, credentials or Xtream. */
(function(w,d){
"use strict";
var hero=d.getElementById("premium-hero"), art=d.getElementById("premium-hero-art"),
    heading=d.getElementById("premium-hero-title"), desc=d.getElementById("premium-hero-description"),
    eyebrow=d.getElementById("premium-eyebrow"), items=d.getElementById("items"),
    liveTab=d.querySelector('#tabs [data-kind="live"]'), movieTab=d.querySelector('#tabs [data-kind="vod"]');
if(!hero || !items || !movieTab || !liveTab)return;
var featured=null, scheduled=false;
function updateHero(){
    scheduled=false;
    var first=items.querySelector("button.item"), image=first && first.querySelector("img"), title=d.getElementById("title");
    featured=first;
    if(first){
        var name=first.querySelector("strong");
        heading.textContent=name ? name.textContent : "Destaque";
        eyebrow.textContent=title ? title.textContent : "THEATER 4 PREMIUM";
        desc.textContent="Selecione para assistir ou ver os episódios disponíveis.";
        if(image && image.src){
            art.src=image.src; art.hidden=false;
        }else{art.hidden=true;art.removeAttribute("src");}
        d.getElementById("premium-play").textContent="▶ Selecionar destaque";
    }else{
        heading.textContent="Seu entretenimento em um só lugar";
        eyebrow.textContent="THEATER 4 PREMIUM";
        desc.textContent="Explore filmes, séries e canais ao vivo usando as setas do controle.";
        art.hidden=true;art.removeAttribute("src");
        d.getElementById("premium-play").textContent="▶ Explorar filmes";
    }
}
function refresh(){if(!scheduled){scheduled=true;w.requestAnimationFrame ? w.requestAnimationFrame(updateHero) : w.setTimeout(updateHero,0);}}
new MutationObserver(refresh).observe(items,{childList:true});
d.getElementById("premium-play").onclick=function(){if(featured && d.body.contains(featured))featured.click();else movieTab.click();};
d.getElementById("premium-live").onclick=function(){liveTab.click();};
d.getElementById("premium-home").onclick=function(){liveTab.click();hero.scrollIntoView({block:"start"});d.getElementById("premium-play").focus();};
d.body.classList.add("theater4-premium");
updateHero();
})(window,document);
