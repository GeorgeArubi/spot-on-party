/*jslint */
/*globals Ext*/
"use strict";

Ext.application({
    name: 'SOP',

    views: ["Login", "ChooseParty"],
    controllers: ["Facebook"],

    launch: function () {
        this.facebookAppId =  '233580756759588';
        //main logic in the Facebook controller
    },
});
