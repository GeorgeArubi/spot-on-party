/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.PartyController', {
    extend: 'SOP.controller.FacebookAuthenticatedController',
    requires: ["SOP.model.Party"],

    config: {
        routes: {
            "": "showChooseParty",
            "party/:party_id": "showParty",
        },
        choosePartyPickerView: null,
    },


    generateAndAddChoosePartyView: function (callback) {
        var that = this;
        SOP.model.Party.loadActivePartiesForLoggedinUser(function (parties) {
            var store = Ext.create("Ext.data.Store", {
                model: "SOP.model.Party",
                data: parties,
            });
            SOP.domain.SopBaseDomain.on("addparty", function (party_info) {
                var party = new SOP.model.Party(party_info);
                store.add(party);
            });
            var view = Ext.create("SOP.view.ChooseParty", {store: store});
            view.on("listitemtap", that.onListItemTap, that);
            view.on("back", that.onBack, that);
            Ext.Viewport.add(view);
            that.setChoosePartyPickerView(view);
            callback();
        });
    },

    showChooseParty: function () {
        var that = this;
        var view = that.getChoosePartyPickerView();
        if (!view) {
            //new
            that.startLoading();
            that.generateAndAddChoosePartyView(function () {
                that.stopLoading();
            });
        } else {
            that.stopLoading();
            view.pop(view.items.length - 2); // 2 items need to remain (it won't pop more anyways) 
        }
    },

    showParty: function (party_id_string) {
        var that = this;
        var party_id = parseInt(party_id_string, 10);
        this.startLoading();
        var loadAndShowView = function () {
            SOP.model.Party.loadActiveAndFollow(party_id, function (party) {
                if (!party) {
                    console.log("help, party doesn't exist");
                    SOP.app.redirectTo("");
                } else {
                    that.stopLoading();
                    var view = Ext.create("SOP.view.PartyTabs", {party: party, myNavigationView: that.getChoosePartyPickerView()});
                    that.getChoosePartyPickerView().push(view);
                    view.down("playlistview").on("itemdelete", function (playlistEntry) {
                        SOP.domain.SopBaseDomain.removeSong(party.get('id'), playlistEntry.position, function (action) {
                            console.log("removed: ", action);
                            party.feed([action]);
                        });
                    });
                }
            });
        };
        if (!that.getChoosePartyPickerView()) {
            //hasn't been loaded yet, direct access, load it first
            that.generateAndAddChoosePartyView(loadAndShowView);
        } else {
            loadAndShowView();
        }

    },

    onListItemTap: function (view, party) {
        this.startLoading();
        SOP.app.redirectTo(party);
    },

    onBack: function (view) {
        SOP.app.redirectTo("");
        return false;
    },
});
