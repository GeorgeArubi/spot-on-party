PM = window.PM || {};
PM.templates = PM.templates || {};
PM.templates["add-track-overlay"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<h3>Find and add songs to the party</h3>\n<input type="search" id="track-search-box" class="search-box" placeholder="Search" incremental>\n<div id="track-search-results" class="search-results">\n    <div class="throbber"><div></div></div>\n    <ul class="content tracks"></ul>\n</div>\n\n';
}
return __p;
};
PM.templates["invite-user"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<li>\n    <img src="" class="icon">\n    <div class="name"></div>\n    <div class="on-off-slider"><div></div></div>\n</li>\n\n';
}
return __p;
};
PM.templates["invite-users-overlay"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<h3>Invite friends to your party</h3>\n<input type="search" id="users-search-box" class="search-box" placeholder="Search" incremental>\n<div id="users-search-results" class="loading search-results">\n    <div class="throbber"><div></div></div>\n    <ul class="content users"></ul>\n</div>\n<button class="sp-button" id="users-search-invite">Invite</button>\n\n';
}
return __p;
};
PM.templates["new-party-page"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<div class="logo-small"></div>\n<form action="javascript:void(0);" id="new-party-form">\n    <input type="text" id="new-party-name" placeholder="'+
_.escape( default_party_name  )+
'"><input type="submit" value="create new party" id="new-party-submit">\n    <div class="or">or</div>\n    <a href="#history" id="view-party-history">view old parties</a>\n</form>\n<div class="footer">\n    <button class="sp-button" id="logout">log out</button>\n</div>\n \n';
}
return __p;
};
PM.templates["party-page"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<div id="overlay-backdrop"></div>\n<div id="overlay-placeholder"></div>\n<div class="logo-small"></div>\n<div class="buttons">\n    <button class="sp-button sp-icon" id="add-track"><span class="sp-plus"></span>add song</button>\n    <button class="sp-button" id="invite-users">invite friends</button>\n    <button class="sp-button" id="end-party">end party</button>\n</div>\n<div id="users-bar"><div class="arrow arrow-left"></div><div class="arrow arrow-right"></div><ul></ul></div>\n<div id="playlist-placeholder"></div>\n\n';
}
return __p;
};
PM.templates["tracks-search-results"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='';
 _.each(tracks, function (track) { 
;__p+='\n<li>\n    <div class="name">'+
_.escape( track.get("name") )+
'</div>\n    <div class="artist">'+
_.escape( track.get("artist") )+
'</div>\n    <div class="album">'+
_.escape( track.get("album") )+
'</div>\n</li>\n';
 }); 
;__p+='\n\n';
}
return __p;
};
PM.templates["welcome-page"]=function(obj){
var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};
with(obj||{}){
__p+='<div class="logo">\n<!--        <img src="img/logo.svg"> -->\n    <img src="img/logo.png">\n    <h2>Share control of your party music with your friends</h2>\n</div>\n<div class="facebook-login">\n    <div class="disclaimer">\n        I understand that when I log into my Facebook account below. Partymode will be able to associate information about my spotify use, such as library and listening history, with my Facebook account. Partymode\'s collection and use of this information will be governed by the Partymode Privacy Policy.\n    </div>\n    <br>\n    <button class="fb-login-button"></button>\n</div>\n\n';
}
return __p;
};
