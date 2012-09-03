/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.spotifyapp.ChooseParty", {
    extend: "Ext.navigation.View",
    xtype: "chooseparty",
    requires: ["Ext.dataview.List", "Ext.form.Panel", "Ext.Button", ],

    config: {
        id: "choosePartyPicker",
        items: [{
            title: "Start new party",
            layout: "card",
            localid: "choose-container",
            items: [
                {
                    xtype: "container",
                    layout: "vbox",
                    items: [
                        {xtype: "button", text: "continue old party", cls: "continue-old-party", localid: "continue-old-party"},
                        {
                            xtype: "formpanel",
                            flex: 1,
                            items: [
                                {xtype: "textfield", label: "party name", name: "new-party-name"},
                            ],
                        }
                    ],
                },
                {
                    xtype: "container",
                    localid: "flipside",
                    layout: "vbox",
                    items: [
                        {xtype: "button", text: "create new party", cls: "create-new-party", localid: "create-new-party"},
                    ],
                },
            ],
        }],
        listeners: {
            initialize: "onInitialize",
        },
        store: null,
    },

    onInitialize: function () {
        var that = this;
        var list = Ext.create("Ext.dataview.List", {
            flex: 1,
            itemTpl: '{name}',
            store: that.getStore(),
        });
        that.down("[localid=flipside]").add(list);
        that.down("[localid=continue-old-party]").on("tap", function () {
            that.down("[localid=choose-container]").animateActiveItem(1, {type: "flip", duration: 1000});
            that.down("[localid=choose-container]").setTitle("Continue old party");
        });
        that.down("[localid=create-new-party]").on("tap", function () {
            that.down("[localid=choose-container]").animateActiveItem(0, {type: "flip", duration: 1000});
            that.down("[localid=choose-container]").setTitle("Start new party");
        });
        list.on("itemtap", that.onListItemTap, that);
        Ext.each(["addrecords", "clear", "removerecords", "updaterecord"], function (eventname) {
            that.getStore().on(eventname, that.onStoreChange, that);
        });
        that.down("textfield").on("action", function (partyname) {that.fireEvent("createparty", that, partyname.getValue()); });

        that.onStoreChange();
    },

    onListItemTap: function (list, index, target, record, event) {
        this.fireEvent("listitemtap", this, record);
        Ext.defer(function () {
            list.deselectAll();
        }, 200);
    },

    onStoreChange: function () {
        var that = this;
        if (that.getStore().getAllCount() === 0) {
            that.addCls("no-recoverable-parties");
        } else {
            that.removeCls("no-recoverable-parties");
        }
    },
});

