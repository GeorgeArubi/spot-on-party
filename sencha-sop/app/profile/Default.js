/*jslint browser:true, vars: true */
/*globals Ext, SOP  */
"use strict";

/**
 */
Ext.define('SOP.profile.Default', {
    extend: "Ext.app.Profile",
    requires: ["SOP.domain.FacebookWebDomain", "SOP.domain.SpotifyWebDomain"],

    config: {
        name: "Default",
        views: ["ChooseParty", "PartyTabs", ],
        controllers: ["PartyController", ],
    },

    isActive: function () {
        return true;
    },

    launch: function () {
        console.log("Default profile activated");
        Ext.ClassManager.set("SOP.domain.SpotifyDomain", SOP.domain.SpotifyWebDomain);
        Ext.ClassManager.set("SOP.domain.FacebookDomain", SOP.domain.FacebookWebDomain);
    },

});
