/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.PartyController', {
    extend: 'SOP.controller.FacebookAuthenticatedController',
    requires: ["SOP.model.Party", "SOP.model.Track", ],

    config: {
        routes: {
            "": "showChooseParty",
            "party/:party_id": "showParty",
        },
        choosePartyPickerView: null,
        addSongsView: null,
        inviteUsersView: null,
    },


    generateAndAddChoosePartyView: function (callback) {
        throw "Abstract function";
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
        throw "Abstract function";
    },

    setPartyEventHandlers: function (view, party) {
        var that = this;
        view.down("playlistview").on("itemdelete", function (playlistEntry) {
            SOP.domain.SopBaseDomain.removeSong(party.get('id'), playlistEntry.position, function (actions) {
                console.log("removed: ", actions);
                party.feed(actions);
            });
        });
        view.down("userlistview").on("itemdelete", function (userInParty) {
            SOP.domain.SopBaseDomain.kickUsers(party.get('id'), [userInParty.user.get('id')], function (actions) {
                console.log("kicked: ", actions);
                party.feed(actions);
            });
        });
        view.on("adduserbuttontap", function () {
            if (!that.getInviteUsersView()) {
                that.setInviteUsersView(Ext.create("SOP.view.InviteUsersView"));
                that.getInviteUsersView().on("cancel", function () {that.getInviteUsersView().hide(); });
                that.getInviteUsersView().on("inviteusers", function (user_ids) {
                    SOP.domain.SopBaseDomain.inviteUsers(party.get('id'), user_ids, function (actions) {
                        console.log("invited: ", actions);
                        party.feed(actions);
                        that.getInviteUsersView().hide();
                    });
                });
                Ext.Viewport.add(that.getInviteUsersView());
            }
            that.getInviteUsersView().show();
        });
        view.on("addsongbuttontap", function () {
            if (!that.getAddSongsView()) {
                that.setAddSongsView(Ext.create("SOP.view.AddSongsView"));
                that.getAddSongsView().on("cancel", function () {that.getAddSongsView().hide(); });
                that.getAddSongsView().on("addtrack", function (track_id) {
                    SOP.domain.SopBaseDomain.addSong(party.get('id'), track_id, function (actions) {
                        console.log("added: ", actions);
                        party.feed(actions);
                        that.getAddSongsView().hide();
                    });
                });
                that.getAddSongsView().on("invalidatesearchresults", function (terms) {
                    var searchresults = that.getAddSongsView().down("[localid=searchresults]");
                    // -- doesn't work since enter is keyup as well                                searchresults.addCls("clear");
                });
                that.getAddSongsView().on("search", function (terms) {
                    var searchresults = that.getAddSongsView().down("[localid=searchresults]");
                    searchresults.addCls("loading");
                    searchresults.removeCls("clear");
                    SOP.model.Track.search(terms, function (tracks) {
                        searchresults.removeCls("loading");
                        searchresults.down("dataview").getStore().setData(tracks);
                    });
                });
                Ext.Viewport.add(that.getAddSongsView());
            }
            that.getAddSongsView().show();
        });
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
