/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.default.PartyController', {
    extend: "SOP.controller.PartyController",

    generateAndAddChoosePartyView: function (callback) {
        var that = this;
        SOP.model.Party.loadActivePartiesForLoggedinUser(function (parties) {
            var store = Ext.create("Ext.data.Store", {
                model: "SOP.model.Party",
                data: parties,
                destroyRemovedRecords: false,
            });
            SOP.domain.SopBaseDomain.on("addparty", function (party_info) {
                var party = new SOP.model.Party(party_info);
                store.add(party);
            });
            SOP.domain.SopBaseDomain.on("removeparty", function (party_info) {
                var party = new SOP.model.Party(party_info);
                store.remove(party);
            });
            var view = Ext.create("SOP.view.default.ChooseParty", {store: store});
            view.on("listitemtap", that.onListItemTap, that);
            view.on("back", that.onBack, that);
            Ext.Viewport.add(view);
            that.setChoosePartyPickerView(view);
            callback();
        });
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
                    var view = Ext.create("SOP.view.default.PartyTabs", {party: party, myNavigationView: that.getChoosePartyPickerView()});
                    view.on("erased", party.stopFollowing, party, {single: true}); // actually I would have preferred to put this on the delete-event but there doesn't seem to be such an event.... Perhaps better to use both the show and hide events....
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