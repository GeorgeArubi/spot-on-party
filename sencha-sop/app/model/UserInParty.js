/*jslint plusplus:true, vars:true, */
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.UserInParty", {
    extend: "Ext.data.Model",

    config: {
        fields: [
            "sort",
            "user",
            "party",
            "joined",
            "is_owner",
            "created",
            "deleted",
        ],
    },

});
