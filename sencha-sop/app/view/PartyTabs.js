/*jslint sloppy: true*/
/*globals Ext, SOP*/

Ext.define("SOP.view.PartyTabs", {
    extend: "Ext.TabPanel",

    config: {
        tabBarPosition: 'bottom',
        title: "hey man",
        party: null,
    },

    initialize: function () {
        this.callParent(arguments);
        this.add(Ext.create("SOP.view.PlaylistView", {
            store: this.getParty().getPlaylistEntryStore(),
        }));
    },
});
