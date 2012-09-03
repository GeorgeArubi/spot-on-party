/*jslint browser:true, vars: true */
/*globals Ext, SOP */
"use strict";

/**
 */
Ext.define('SOP.profile.SpotifyApp', {
    extend: "Ext.app.Profile",
    requires: ["SOP.domain.FacebookSpotifyDomain", "SOP.domain.SpotifySpotifyDomain", "SOP.domain.SpotifyAppIntegrator"],

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
        Ext.ClassManager.set("SOP.domain.SpotifyDomain", SOP.domain.SpotifySpotifyDomain);
        Ext.ClassManager.set("SOP.domain.FacebookDomain", SOP.domain.FacebookSpotifyDomain);
        Ext.syncRequire(["SOP.domain.FacebookSpotifyDomain", "SOP.domain.SpotifySpotifyDomain", "SOP.domain.SpotifyAppIntegrator"]);
        SOP.domain.SpotifyAppIntegrator.init();
    },

});
