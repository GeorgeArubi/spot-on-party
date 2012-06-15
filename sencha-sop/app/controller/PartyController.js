/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.PartyController', {
    extend: 'SOP.controller.FacebookAuthenticatedController',
    requires: ["SOP.view.ChooseParty", "SOP.model.Party"],

    config: {
        routes: {
            "": "showChooseParty"
        },
    },


    showChooseParty: function () {
        var that = this;
        SOP.model.Party.loadActivePartiesForLoggedinUser(function (parties) {
            var store = Ext.create("Ext.data.Store", {
                model: "SOP.model.Party",
                data: parties,
                id: "PartyStore",
            });
            var view = Ext.create("SOP.view.ChooseParty", {store: store});
            that.stopLoading();
            Ext.Viewport.add(view);
        });
    },
});
