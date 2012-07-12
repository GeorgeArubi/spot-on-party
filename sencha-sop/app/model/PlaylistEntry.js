/*jslint plusplus:true, vars:true, */
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.PlaylistEntry", {
    extend: "Ext.data.Model",

    config: {
        fields: [
            "track",
            "user",
            "deleted_by_user",
            "created",
            "deleted",
            "position",
            "is_playing",
        ],
    },

});
