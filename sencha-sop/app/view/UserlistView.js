/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.UserlistView", {
    extend: "Ext.dataview.DataView",
    xtype: "userlistview",
    requires: ["SOP.view.UserlistEntryView", ],

    config: {
        title: "Users",
        flex: 1,
        useComponents: true,
        defaultType: "userlistentry",

        listeners: {
            rightbuttontap: function () {
                var that = this;
                that.up("partytabs").fireEvent("adduserbuttontap");
            },
            itemswipe: "onItemSwipe",
            initialize: function () {
                if (!this.getParty().loggedinUserIsAdmin) {
                    this.setRightButtonInfo(null);
                }
            },
        },
        rightButtonInfo: {iconCls: "add", iconMask: true, ui: "action"},
        party: null,
    },

    onItemSwipe: function (container, target, index, event) {
        target.showDeleteConfirm();
    },
});