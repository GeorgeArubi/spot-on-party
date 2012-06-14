/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.PartyController', {
    extend: 'SOP.controller.FacebookAuthenticatedController',
//    requires: ["SOP.view.ChooseParty"],

    config: {
        routes: {
            "": "showChooseParty"
        },
    },


    showChooseParty: function () {
        console.log("choosePartyView");
    },
});
