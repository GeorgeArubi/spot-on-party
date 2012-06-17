/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

Ext.application({
    name: 'SOP',

    requires: [
    ],

    views: ["FacebookLogin", "ChooseParty", "PartyTabs"],
    controllers: ["BaseController", "FacebookAuthenticatedController", "PartyController"],


    launch: function () {
        if (!this.getRouter().recognize(window.location.hash.substr(1))) {
            window.location.hash = "";
        }
    },

});
