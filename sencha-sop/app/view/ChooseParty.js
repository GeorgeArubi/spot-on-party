/*jslint sloppy: true*/
/*globals Ext, SOP*/

Ext.define("SOP.view.ChooseParty", {
    extend: "Ext.navigation.View",
    requires: ["Ext.dataview.List", "Ext.MessageBox"],

    config: {
        id: "choosePartyPicker",
        items: [{
            title: "Choose Party",
            layout: "vbox",
        }],
        useTitleForBackButtonText: true,
    },

    initialize: function () {
        var that = this;
        that.callParent(arguments);
        that.list = Ext.create("Ext.dataview.List", {
            flex: 1,
            itemTpl: '{name}',
            store: that.store,
        });
        that.items.first().add([this.list]);
        that.list.on("itemtap", that.onListItemTap, that);
        Ext.each(["addrecords", "clear", "removerecords", "updaterecord"], function (eventname) {
            that.store.on(eventname, that.onStoreChange, that);
        });
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
        if (that.store.getAllCount() === 0) {
            Ext.Msg.show({
                title       : "No parties",
                message     : "Nobody has invited you to a party yet",
                buttons     : [],
            });
        } else {
            Ext.Msg.hide();
        }
    },
});

