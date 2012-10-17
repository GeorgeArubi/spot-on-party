PM = window.PM || {};
PM.templates = PM.templates || {};
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
PM.templates["party-overview-page"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
}
return __p;
};
