PM = window.PM || {};
PM.templates = PM.templates || {};
PM.templates["add-track-overlay"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<h3>Find and add songs to the party</h3>\n<input type="search" id="track-search-box" class="search-box" placeholder="Search" incremental>\n<div id="track-search-results" class="search-results">\n    <div class="throbber"><div></div></div>\n    <ul class="content tracks"></ul>\n</div>\n\n';
}
return __p;
};
PM.templates["invite-user"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li>\n    <img src="" class="icon">\n    <div class="name"></div>\n    <div class="on-off-slider"><div></div></div>\n</li>\n\n';
}
return __p;
};
PM.templates["invite-users-overlay"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<h3>Invite friends to your party</h3>\n<input type="search" id="users-search-box" class="search-box" placeholder="Search" incremental>\n<div id="users-search-results" class="loading search-results">\n    <div class="throbber"><div></div></div>\n    <ul class="content users"></ul>\n</div>\n<button class="sp-button" id="users-search-invite">Invite</button>\n\n';
}
return __p;
};
PM.templates["old-party"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 var members_in_party = party.getMembersInPartyOrderedByActive() 
__p+='\n';
 var tracks_in_playlist = party.getNotDeletedTracksInPlaylist() 
__p+='\n';
 var members_shown = 8 
__p+='\n<div class="party">\n    <div class="art"></div><div class="info">\n        <h2 class="party-name">'+
((__t=( party.get("name") ))==null?'':_.escape(__t))+
'</h2>\n        <div class="party-when">'+
((__t=( clutils.pastDateText(party.get("last_updated")) ))==null?'':_.escape(__t))+
'</div>\n        <div class="users-bar">\n            ';
 _.each(members_in_party.slice(0,members_shown), function (user_in_party) { 
                
__p+='<img src="'+
((__t=( user_in_party.getUser().getProfilePictureUrl() ))==null?'':_.escape(__t))+
'">';

             }); 
__p+='\n            ';
 if (members_in_party.length > members_shown ) { 
__p+='\n            <div class="more">+ '+
((__t=( (members_in_party.length - members_shown) ))==null?'':_.escape(__t))+
' more</div>\n            ';
 } 
__p+='\n        </div>\n        <div class="buttons">\n            <button class="sp-button sp-icon add-as-playlist"><span class="sp-plus"></span>Add as playlist</button>\n            <button class="sp-button sp-icon share"><span class="sp-share"></span>Share</button>\n            <button class="sp-button continue-party">Continue party</button>\n        </div>\n    </div>\n    <div class="playlist-placeholder clipped">\n        playlist comes here!!\n    </div>\n    ';
 if (tracks_in_playlist.length > 6) { 
__p+='\n        <div class="playlist-see-all">See all '+
((__t=( tracks_in_playlist.length ))==null?'':_.escape(__t))+
' tracks</div>\n    ';
 } 
__p+='\n</div>\n';
}
return __p;
};
PM.templates["parties-overview-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="logo-small"></div>\n<form action="javascript:void(0);" id="new-party-form">\n    <div class="text welcome">Welcome to partymode. Go on and launch your party</div>\n    <span class="text">&mdash;&gt;</span>\n    <input type="text" id="new-party-name" placeholder="'+
((__t=( default_party_name  ))==null?'':_.escape(__t))+
'">\n    <input type="submit" class="sp-button" value="start new party" id="new-party-submit">\n</form>\n    \n<div id="parties"><div class="or text">&mdash;&gt; or check your previous parties</div></div>\n<div class="throbber"><div></div></div>\n<div class="footer">\n    <button class="sp-button" id="logout">log out</button>\n</div>\n \n';
}
return __p;
};
PM.templates["party-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div id="overlay-backdrop"></div>\n<div id="overlay-placeholder"></div>\n<div class="coverphoto-container">\n    <img class="coverphoto">\n    <div class="buttons">\n        <button class="sp-button" id="add-track">add song</button>\n        <button class="sp-button" id="invite-users">invite friends</button>\n        <a class="sp-button" id="end-party" href="#party/new">end party</a>\n    </div>\n    <div class="currentsong">\n        <img>\n        <div class="title"></div>\n        <div class="artist"></div>\n        <div class="requested-by"></div>\n    </div>\n\n</div>\n<div id="users-bar"><div class="arrow arrow-left"></div><div class="arrow arrow-right"></div><ul></ul></div>\n<div id="playlist-placeholder"></div>\n\n';
}
return __p;
};
PM.templates["tracks-search-results"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 _.each(tracks, function (track) { 
__p+='\n<li>\n    <div class="name">'+
((__t=( track.get("name") ))==null?'':_.escape(__t))+
'</div>\n    <div class="artist">'+
((__t=( track.get("artist") ))==null?'':_.escape(__t))+
'</div>\n    <div class="album">'+
((__t=( track.get("album") ))==null?'':_.escape(__t))+
'</div>\n</li>\n';
 }); 
__p+='\n\n';
}
return __p;
};
PM.templates["welcome-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="logo">\n<!--        <img src="img/logo.svg"> -->\n    <img src="img/logo.png">\n    <h2>Share control of your party music with your friends</h2>\n</div>\n<div class="facebook-login">\n    <div class="disclaimer">\n        I understand that when I log into my Facebook account below. Partymode will be able to associate information about my spotify use, such as library and listening history, with my Facebook account. Partymode\'s collection and use of this information will be governed by the Partymode Privacy Policy.\n    </div>\n    <br>\n    <button class="fb-login-button"></button>\n</div>\n\n';
}
return __p;
};
