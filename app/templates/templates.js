PM = window.PM || {};
PM.templates = PM.templates || {};
PM.templates["active-party-in-list"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="party active-party">\n    <a href="#activeparty_'+
((__t=( encodeURIComponent(party.id) ))==null?'':_.escape(__t))+
'">\n        <h2 class="party-name">'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h2>\n        <span class="ui-li-aside">u: '+
((__t=( party.getMembersInPartyOrderedByActive().length ))==null?'':_.escape(__t))+
' t: '+
((__t=( party.getNotDeletedTracksInPlaylist().length ))==null?'':_.escape(__t))+
'</span>\n    </a>\n</li>\n';
}
return __p;
};
PM.templates["all-parties-list"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (parties.length > 0) { 
__p+='\n    ';
 _.each(parties, function (party) { 
__p+='\n    <li class="all-party">\n        <a href="#oldparty_'+
((__t=( encodeURIComponent(party.id) ))==null?'':_.escape(__t))+
'">\n            <h2 class="party-name">'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h2>\n            <div class="party-when">'+
((__t=( clutils.pastDateText(party.get("last_updated")) ))==null?'':_.escape(__t))+
'</div>\n            <span class="ui-li-aside">u: '+
((__t=( party.getMembersInPartyOrderedByActive().length ))==null?'':_.escape(__t))+
' t: '+
((__t=( party.getNotDeletedTracksInPlaylist().length ))==null?'':_.escape(__t))+
'</span>\n        </a>\n    </li>\n    ';
 }); 
__p+='\n';
 } 
__p+='\n';
 if (parties_left > 0 ) { 
__p+='\n<li>This should be a load-more button (or unlimited scrolling) but this is not implemented yet</li>\n';
 } 
__p+='\n\n\n';
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
PM.templates["party-overview-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div data-role="header">\n    <h1>Parties</h1>\n    <button id="logout">logout</button>\n</div>\n\n<div data-role="content">\n    <ul class="parties" data-role="listview">\n        <li data-role="list-divider" id="active-parties-divider">Active parties</li> \n        <li class="no-active-parties-message active-party">\n            <div>You are not invited to any parties at the moment</div>\n        </li>\n        <li data-role="list-divider" id="all-parties-divider">All parties</li> \n    </ul>\n</diV>\n';
}
return __p;
};
