/*jslint browser:true, vars: true */
/*globals Ext, SOP */
"use strict";

/**
 */
Ext.define('SOP.profile.SpotifyApp', {
    extend: "Ext.app.Profile",

    config: {
        name: "SpotifyApp",
        views: ["ChooseParty", "PartyPane", ],
        controllers: ["PartyController", ],
    },

    isActive: function () {
        return !!window.getSpotifyApi;
    },

    launch: function () {
        console.log("SposityApp profile activated");
        Ext.syncRequire(["SOP.domain.FacebookSpotifyDomain", "SOP.domain.SpotifySpotifyDomain", "SOP.domain.SpotifyAppIntegrator"]);
        SOP.domain.SpotifyAppIntegrator.init();
    },

});
