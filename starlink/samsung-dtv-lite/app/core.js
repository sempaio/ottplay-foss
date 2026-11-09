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
    return {isValidAccount:isValidAccount,streamUrl:streamUrl,pickTestChannel:pickTestChannel};
});
