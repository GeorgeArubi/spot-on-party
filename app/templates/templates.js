PM = window.PM || {};
PM.templates = PM.templates || {};
PM.templates["active-party-in-list"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="party active-party" data-icon="arrow-r ui-icon-alt">\n    <a href="#activeparty_'+
((__t=( encodeURIComponent(party.id) ))==null?'':_.escape(__t))+
'">\n        <h2 class="party-name">'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h2>\n        <span class="ui-li-aside">\n            <span class="number-of-users"><span>'+
((__t=( party.getMembersInPartyOrderedByActive().length ))==null?'':_.escape(__t))+
'</span></span>\n            <span class="number-of-tracks"><span>'+
((__t=( party.getNotDeletedTracksInPlaylist().length ))==null?'':_.escape(__t))+
'</span></span>\n        </span>\n    </a>\n</li>\n';
}
return __p;
};
PM.templates["add-song-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>Add songs</h1>\n    <a href="#activeparty_'+
((__t=( party.id ))==null?'':_.escape(__t))+
'" data-rel="back" data-role="button" class="ui-btn-right">cancel</a>\n</div>\n\n<div data-role="content">\n    <form id="searchform" action="javascript:void(0)">\n        <input type="search" id="searchfield" name="search" value="" />\n    </form>\n    <div data-role="navbar">\n        <ul id="searchdomain">\n            <li><a id="search-in-tracks" class="ui-btn-active ui-state-persist">Tracks</a></li>\n            <li><a id="search-in-albums">Albums</a></li>\n            <li><a id="search-in-artists">Artists</a></li>\n        </ul>\n    </div>\n    <ul class="search-results" data-role="listview">\n    </ul>\n</div>\n\n\n';
}
return __p;
};
PM.templates["error-message"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="popup" class="pm-popup error-message-popup" data-history="false" data-overlay-theme="a">\n    <p>An error has occured. Please reload this page to continue</p>\n    <a href="javascript:document.location.reload();" data-role="button">reload</a>\n</div>\n\n';
}
return __p;
};
PM.templates["login-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>Partymode</h1>\n</div>\n<div data-role="content">\n';
 if (party_id) { 
__p+='\n    <h2>You have been invited to join a party</h2>\n    <p>and control its music. Before you enter however, we want to know who you are. Please log in with your facebook account below. We promise not to publish anything on your timeline, unless you explicitly ask for it.</p>\n    ';
 } else { 
__p+='\n    <p>At Partymode you can control music at parties you have been invited to. If you have been invited to a party, please follow the link you have been sent. You can log in here to get an overview of all parties you were ever invited to.</p>\n    ';
 } 
__p+='\n    <div class="fb-login-button"></div>\n\n    <div class="disclaimer">If you really care about this kind of stuff, you can read our privacy policy</div>\n</div>\n';
}
return __p;
};
PM.templates["old-party-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h1>\n    <a href="#partyoverview" data-role="button" data-icon="arrow-l">back</a>\n    <a href="#oldpartyusers_'+
((__t=( encodeURIComponent(party.id) ))==null?'':_.escape(__t))+
'" data-role="button" data-icon="arrow-l">users</a>\n</div>\n<div data-role="content">\n    <iframe src="https://embed.spotify.com/?uri=spotify:trackset:PREFEREDTITLE:5Z7ygHQo02SUrFmcgpwsKW,1x6ACsKV4UdWS2FMuPFUiT,4bi73jCM02fMpkI11Lqmfe" frameborder="0" allowtransparency="true"></iframe>\n    <div class="party-when">'+
((__t=( clutils.pastDateText(party.get("last_updated")) ))==null?'':_.escape(__t))+
'</div>\n    <div class="playlist">\n        <span class="header">Playlist</span>\n        <ul data-role="listview">\n            ';
 _.each(party.getNotDeletedTracksInPlaylist(), function (track_in_playlist, index) { 
__p+='\n                ';
 var id = "id_" + track_in_playlist.cid 
__p+='\n                <li id="'+
((__t=( id ))==null?'':_.escape(__t))+
'"><a href="'+
((__t=( track_in_playlist.get("track_id") ))==null?'':_.escape(__t))+
'">\n                    <h2 class="track-name"></h2>\n                    <div class="track-album"></div>\n                    <div class="track-artist"></div>\n                    <div class="track-duration"></div>\n                </a>\n                </li>\n                ';
 track_in_playlist.getTrack().onLoaded(function (track) {
                    $('#' + id + ' .track-name').text(track.get("name"));
                    $('#' + id + ' .track-album').text(track.get("album"));
                    $('#' + id + ' .track-artist').text(track.get("artist"));
                    $('#' + id + ' .track-duration').text(clutils.formatTimeMs(track.get("duration")));
                }); 
__p+='\n            ';
 }); 
__p+='\n        </ul>\n    </div>\n</div>\n';
}
return __p;
};
PM.templates["party-in-list"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="party';
 if (active) { 
__p+=' activeparty';
 } 
__p+=' party_'+
((__t=( party.id ))==null?'':_.escape(__t))+
'" data-icon="arrow-r ui-icon-alt">\n    <a href="#';
 if (active) {
__p+='active';
} else {
__p+='old';
 } 
__p+='party_'+
((__t=( encodeURIComponent(party.id) ))==null?'':_.escape(__t))+
'">\n        <h2 class="party-name">'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h2>\n        <h3 class="party-when">'+
((__t=( clutils.pastDateText(party.get("last_updated")) ))==null?'':_.escape(__t))+
'</h3>\n        <span class="ui-li-aside">\n            <span class="number-of-users"><span>'+
((__t=( party.getMembersInPartyOrderedByActive().length ))==null?'':_.escape(__t))+
'</span></span>\n            <span class="number-of-tracks"><span>'+
((__t=( party.getNotDeletedTracksInPlaylist().length ))==null?'':_.escape(__t))+
'</span></span>\n        </span>\n    </a>\n</li>\n';
}
return __p;
};
PM.templates["party-inactive-message"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="popup" class="pm-popup party-inactive-popup" data-history="false" data-overlay-theme="a">\n    <p>The party you\'re looking at is not active at the moment. You can only visit parties that are active.</p>\n    <a href="#partyoverview" data-role="button">back to party overview</a>\n</div>\n';
}
return __p;
};
PM.templates["party-overview-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>Parties</h1>\n    <button id="logout">logout</button>\n</div>\n\n<div data-role="content">\n    <ul class="parties" data-role="listview">\n    </ul>\n</div>\n';
}
return __p;
};
PM.templates["party-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h1>\n    <a href="#partyoverview" data-rel="back" data-role="button" data-icon="arrow-l">back</a>\n    <a href="#activeparty_'+
((__t=( party.id ))==null?'':_.escape(__t))+
'_addsong" data-transition="slidedown" data-role="button">Add song</a>\n</div>\n\n<div data-role="content">\n    <ul class="tracks" data-role="listview">\n        <li class="playlist-empty-message">\n            <div>The playlist is empty, you can add songs with the button in the right top</div>\n        </li>\n        <li data-role="list-divider" id="playlist-divider">Playlist</li> \n    </ul>\n</div>\n\n';
}
return __p;
};
PM.templates["playlist-item"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="track_in_playlist">\n    <div class="icon"></div>\n    <div class="controls">\n        <div class="delete-button"></div><div class="play-button"></div><div class="pause-button"></div>\n    </div>\n    <div class="text title">'+
((__t=( track.getHtmlLazyLoad("name") ))==null?'':__t)+
'</div>\n    <div class="text subtitle">'+
((__t=( track.getHtmlLazyLoad("artist") ))==null?'':__t)+
' &mdash; '+
((__t=( track.getHtmlLazyLoad("album") ))==null?'':__t)+
'</div>\n    <div class="text subtitle">'+
((__t=( user.getHtmlLazyLoad("name") ))==null?'':__t)+
'</div>\n    <div class="text deleted-by"></div>\n</li>\n';
}
return __p;
};
PM.templates["searchresult-albums"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 _.each(tracks, function (track) { 
__p+='\n    <li track_id="'+
((__t=( track.id ))==null?'':_.escape(__t))+
'">\n        <div class="name">'+
((__t=( track.get("name") ))==null?'':_.escape(__t))+
'</div>\n        <div class="artist">'+
((__t=( track.get("artist") ))==null?'':_.escape(__t))+
'</div>\n        <div class="album">'+
((__t=( track.get("album") ))==null?'':_.escape(__t))+
'</div>\n    </li>\n';
 }) 
__p+='\n';
}
return __p;
};
PM.templates["searchresult-tracks"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 _.each(tracks, function (track) { 
__p+='\n    <li track_id="'+
((__t=( track.id ))==null?'':_.escape(__t))+
'">\n        <div class="name">'+
((__t=( track.get("name") ))==null?'':_.escape(__t))+
'</div>\n        <div class="artist">'+
((__t=( track.get("artist") ))==null?'':_.escape(__t))+
'</div>\n        <div class="album">'+
((__t=( track.get("album") ))==null?'':_.escape(__t))+
'</div>\n    </li>\n';
 }) 
__p+='\n';
}
return __p;
};
