/*jslint sloppy: true*/
/*globals Ext, SOP*/

Ext.define("SOP.view.ChooseParty", {
    extend: "Ext.navigation.View",
    requires: ["Ext.dataview.List"],

    config: {
        id: "choosePartyPicker",
        items: [{
            title: "Choose Party",
            layout: "vbox",
        }],
        useTitleForBackButtonText: true,
    },

    initialize: function () {
        this.callParent(arguments);
        this.list = Ext.create("Ext.dataview.List", {
            flex: 1,
            itemTpl: '{name}',
            store: this.store,
        });
        this.items.first().add([this.list]);
        this.list.on("itemtap", this.onListItemTap, this);
    },

    onListItemTap: function (list, index, target, record, event) {
        this.fireEvent("listitemtap", this, record);
        Ext.defer(function () {
            list.deselectAll();
        }, 200);
    }
});

