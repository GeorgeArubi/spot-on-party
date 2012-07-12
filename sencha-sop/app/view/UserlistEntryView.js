/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.UserlistEntryView", {
    extend: "Ext.dataview.component.DataItem",
    xtype: "userlistentry",
    requires: ["Ext.String", "Ext.Label"],

    config: {
        items: [
            {xtype: "panel", cls: "delete-confirm-overlay", localid: "delete-confirm-overlay"},
            {xtype: "container", cls: "delete-confirm-btn-mask", items: [
                {xtype: "button", ui: "decline", cls: "delete-confirm-btn", text: "delete", localid: "delete-confirm-btn"},
            ]},
            {xtype: "label", cls: "user-image", localid: "image"},
            {xtype: "label", cls: "user-name", localid: "name"},
            {xtype: "container", cls: "buttons", items: [
                {xtype: "button", cls: "userlist-delete-btn", iconCls: "trash", iconMask: true, flex: 2, localid: "delete-btn"},
            ], layout: "hbox"},
        ],

        cls: ["userlist-entry", "new", ],

        listeners: {
            updatedata: "onUpdateData",
            initialize: "onInitialize",
        },
        userInParty: null,
    },

    onInitialize: function () {
        var that = this;
        var delete_btn = that.down("[localid=delete-btn]");
        var delete_confirm_overlay = that.down("[localid=delete-confirm-overlay]");
        var delete_confirm_btn = that.down("[localid=delete-confirm-btn]");

        delete_btn.on("tap", that.showDeleteConfirm, that);
        delete_confirm_overlay.element.on("tap", function () {console.log(1); that.getUserlistView().fireEvent("deleteconfirmcancelled"); });
        delete_confirm_btn.on("tap", function () {
            that.hideDeleteConfirm();
            that.getUserlistView().fireEvent("itemdelete", that.getUserInParty());
        });

    },

    getUserlistView: function () {
        var that = this;
        return that.up("userlistview");
    },

    hasCls: function (cls) {
        var that = this;
        var mycls = that.getCls();
        if (Ext.isArray(mycls)) {
            return mycls.indexOf(cls) !== -1;
        }
        return cls === mycls;
    },

    showDeleteConfirm: function () {
        var that = this;
        if (that.hasCls("deleted")) {
            return;
        }
        that.addCls("delete-confirm");
        that.getUserlistView().addCls("delete-confirm-mask");
        that.getUserlistView().on("deleteconfirmcancelled", that.hideDeleteConfirm, that);
    },

    hideDeleteConfirm: function () {
        var that = this;
        that.removeCls("delete-confirm");
        that.getUserlistView().removeCls("delete-confirm-mask");
        that.getUserlistView().un("deleteconfirmcancelled", that.hideDeleteConfirm, that);
    },

    onUpdateData: function (container, userInParty) {
        var that = this;
        that.setUserInParty(userInParty);
        var user = userInParty.user;

        var nameLabel = that.down("[localid=name]");
        var imageLabel = that.down("[localid=image]");

        imageLabel.setHtml('<img src="' + Ext.String.htmlEncode(user.getProfilePictureUrl()) + '">');
        nameLabel.setHtml(Ext.String.htmlEncode(user.get('name')));
        if (userInParty.deleted) {
            that.addCls("deleted");
        } else {
            that.removeCls("deleted");
        }
        if (userInParty.joined) {
            that.addCls("joined");
        } else {
            that.removeCls("joined");
        }
        if (!userInParty.party.loggedinUserIsAdmin() || userInParty.is_owner) {
            that.down("[localid=delete-btn]").hide(); // owners can delete anyone, except owner
        }
        Ext.defer(function () {that.removeCls("new"); }, 1); //allows for new animation
    },
});
