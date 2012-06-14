/*jslint */
/*globals Ext*/
"use strict";

Ext.application({
    name: 'SOP',

    views: ["Login", "ChooseParty"],
    controllers: ["Facebook"],
    models: ["Party", "Playlist", "Track"],

    launch: function () {
        this.facebookAppId =  '233580756759588';
        this.SopBackend =  '//tiggr.local:8081/api/1/';
        //main logic in the Facebook controller
    },
});
