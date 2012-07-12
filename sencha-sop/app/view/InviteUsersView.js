/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.InviteUsersView", {
    extend: "Ext.Container",
    xtype: "inviteusers",
    requires: ["Ext.field.Search", "Ext.TitleBar", "Ext"],

    config: {
        layout: "vbox",
        cls: "addsongs",
        items: [
            {xtype: "titlebar", docked: "top", title: "Add songs", items: [
                {xtype: "button", text: "cancel", align: "left", localid: "cancel-btn", ui: "decline"},
                {xtype: "button", text: "invite", align: "right", localid: "invite-btn", ui: "action", disabled: true},
            ]},
            {xtype: "searchfield", },
            {
                xtype: "list",
                localid: "friendlist",
                cls: "friendlist",
                itemTpl: "{name}",
                flex: 1,
                grouped: true,
                indexBar: true,
                mode: "SIMPLE",
            },
        ],
        style: "z-index: 100;",
        listeners: {
            initialize: "onInitialize",
            hide: "onHide",
            aftershowanimation: "onAfterShowAnimation",
        },
    },

    onInitialize: function () {
        var that = this;
        that.down("[localid=cancel-btn]").on("tap", function () {that.fireEvent("cancel"); });
        var store = Ext.create("Ext.data.Store", {
            model: SOP.model.User,
            grouper: {
                sortProperty: "name",
                groupFn: function (user) {return user.get('name').substr(0, 1); },
            },
            sorters: ["name", ],
        });
        that.down("[localid=friendlist]").setStore(store);
        SOP.model.User.loadAllFriends(function (friends) {
            store.add(friends);
        });

        that.on("hide", function () { //cleanup
            that.down("searchfield").setValue("");
            store.clearFilter();
            that.down("[localid=friendlist]").deselectAll();
        });

        var lastsearchvalue = "";
        that.down("searchfield").on("keyup", function (search) {
            var searchvalue = search.getValue();
            if (searchvalue !== lastsearchvalue) {
                if (searchvalue.trim() === "") {
                    store.clearFilter();
                } else {
                    if (searchvalue.indexOf(lastsearchvalue) !== 0) {
                        store.clearFilter(); // else previous filters should remain active, results in faster matches
                    }
                    var searches = searchvalue.toLowerCase().split(" ");
                    store.filterBy(function (user) {
                        var names = user.get("name").toLowerCase().split(" ");
                        return Ext.Array.every(searches, function (searchpart) {
                            return Ext.Array.some(names, function (namepart) {
                                return namepart.indexOf(searchpart) === 0;
                            });
                        });
                    });
                }
                lastsearchvalue = searchvalue;
            }
        });

        that.down("[localid=friendlist]").on("selectionchange", that.onSelectionChange, that);

        that.down("[localid=invite-btn]").on("tap", function (button) {
            if (button.getDisabled()) {
                return;
            }
            var users = that.down("[localid=friendlist]").getSelection();
            that.fireEvent("inviteusers", Ext.Array.map(users, function (user) {return user.get('id'); }));
        });

        that.setShowAnimation({
            type: "slideIn",
            direction: "up",
            listeners: {animationend: function () {that.fireEvent("aftershowanimation"); }, },
        });
        that.setHideAnimation({
            type: "slideOut",
            direction: "down",
            listeners: {animationend: function () {that.fireEvent("afterhideanimation"); }, },
        });
    },

    onSelectionChange: function (listview) {
        var that = this;
        that.down("[localid=invite-btn]").setDisabled(!listview.hasSelection());
    },

    onHide: function () {
        var that = this;
        that.down("searchfield").blur();
    },

    onAfterShowAnimation: function () {
        var that = this;
        that.down("searchfield").focus();
    }
});