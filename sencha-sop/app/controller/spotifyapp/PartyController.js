/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.spotifyapp.PartyController', {
    extend: "SOP.controller.PartyController",

    generateAndAddChoosePartyView: function (callback) {
        var that = this;
        SOP.model.Party.loadOwnedParties(function (parties) {
            var store = Ext.create("Ext.data.Store", {
                model: "SOP.model.Party",
                data: parties,
                destroyRemovedRecords: false,
            });
            SOP.domain.SopBaseDomain.on("addparty", function (party_info) {
                var party = new SOP.model.Party(party_info);
                SOP.domain.FacebookDomain.getLoggedinUserId(function (userId) {
                    if (party.get("owner_id") === userId) {
                        store.add(party);
                    }
                });
            });
            var view = Ext.create("SOP.view.spotifyapp.ChooseParty", {store: store});
            view.on("createparty", that.onCreateParty, that);
            view.on("listitemtap", that.onListItemTap, that);
            view.on("back", that.onBack, that);
            Ext.Viewport.add(view);
            that.setChoosePartyPickerView(view);
            callback();
        });
    },

    onCreateParty: function (view, name) {
        var that = this;
        that.startLoading();
        SOP.model.Party.create(name, function (party) {
            SOP.app.redirectTo(party);
        });
    },

    showParty: function (party_id_string) {
        var that = this;
        var party_id = parseInt(party_id_string, 10);
        this.startLoading();
        var loadAndShowView = function () {
            SOP.model.Party.loadOwnAndActivate(party_id, function (party) {
                if (!party) {
                    console.log("help, party doesn't exist");
                    SOP.app.redirectTo("");
                } else {
                    that.stopLoading();
                    var view = Ext.create("SOP.view.spotifyapp.PartyPane", {party: party, myNavigationView: that.getChoosePartyPickerView()});
                    view.on("erased", function () {party.deactivate(); }, {single: true}); // actually I would have preferred to put this on the delete-event but there doesn't seem to be such an event.... Perhaps better to use both the show and hide events....
                    that.getChoosePartyPickerView().push(view);
                    that.setPartyEventHandlers(view, party);
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
});