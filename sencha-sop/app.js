/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

Ext.application({
    name: 'SOP',

    requires: [
    ],

    views: ["FacebookLogin"],
    controllers: ["BaseController", "FacebookAuthenticatedController", "PartyController"],


    launch: function () {
    },

});
