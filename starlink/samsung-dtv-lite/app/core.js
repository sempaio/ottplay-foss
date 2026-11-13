(function(root,factory){
    if(typeof module==='object' && module.exports) module.exports=factory();
    else root.StarlinkLiteCore=factory();
})(this,function(){
    'use strict';
    function isValidAccount(data){
        var u=data && data.user_info;
        return !!(u && (u.auth===1 || u.auth==='1') && (!u.status || u.status==='Active'));
    }
    function streamUrl(origin,username,password,item){
        if(typeof origin!=='string' || !/^https:\/\/[^\/?#]+$/.test(origin)) throw new Error('Invalid origin');
        if(!item || !/^\d+$/.test(String(item.stream_id))) throw new Error('Invalid stream ID');
        var ext=item.container_extension==='ts'?'ts':'m3u8';
        return origin+'/live/'+encodeURIComponent(username)+'/'+encodeURIComponent(password)+'/'+item.stream_id+'.'+ext;
    }
    function pickTestChannel(items){
        if(!Array.isArray(items))return null;
        var i,title;
        for(i=0;i<items.length;i++){
            title=String(items[i].name||'').toLowerCase();
            if(title.indexOf('tv cultura')>=0 && title.indexOf('720p')>=0)return items[i];
        }
        for(i=0;i<items.length;i++){
            title=String(items[i].name||'').toLowerCase();
            if(title.indexOf('tv cultura')>=0)return items[i];
        }
        return items.length?items[0]:null;
    }
    // Avoid restarting live streams during normal AVPlay buffering, and cap recovery loops.
    function isStalled(state,now){
        if(!state || typeof state.lastAdvanceAt!=='number')return false;
        if(state.preparingSince>0)return now-state.preparingSince>=30000;
        if(state.bufferingSince>0)return now-state.bufferingSince>=45000;
        return now-state.lastAdvanceAt>=(state.progressEvents>0?15000:20000);
    }
    function shouldReconnect(state,now){
        return !!(state && state.retryCount<3 && isStalled(state,now));
    }
    function isTransientLoginFailure(error){
        return /^(Falha de rede|Tempo esgotado|HTTP (408|429|5[0-9]{2}))$/.test(String(error||''));
    }
    // Samsung D-pad navigation on login must be explicit: browsers do not
    // always move focus between TV Web App inputs automatically.
    // 65376 = native Samsung IME "Done"; 13 on input remains the IME opener.
    function loginFocusTarget(currentId,key){
        var vertical=['username','password','remember-login','login-button'];
        var field=currentId==='username-keyboard'?'username':
                  currentId==='password-keyboard'?'password':currentId;
        var index=vertical.indexOf(field);
        if(key===65376){
            if(field==='username')return 'password';
            if(field==='password')return 'login-button';
            return '';
        }
        if(key===13)return index<0?'username':'';
        if(key===39){
            if(currentId==='username')return 'username-keyboard';
            if(currentId==='password')return 'password-keyboard';
            return '';
        }
        if(key===37){
            if(currentId==='username-keyboard')return 'username';
            if(currentId==='password-keyboard')return 'password';
            return '';
        }
        if(key!==38 && key!==40)return '';
        if(index<0)return 'username';
        var next=Math.max(0,Math.min(vertical.length-1,index+(key===40?1:-1)));
        return vertical[next];
    }
    return {isValidAccount:isValidAccount,streamUrl:streamUrl,pickTestChannel:pickTestChannel,isStalled:isStalled,shouldReconnect:shouldReconnect,isTransientLoginFailure:isTransientLoginFailure,loginFocusTarget:loginFocusTarget};
});
