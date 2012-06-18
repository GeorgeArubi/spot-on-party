/*jslint vars: true,*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.User", {
    extend: "Ext.data.Model",
    requires: ["SOP.domain.FacebookDomain"],


    statics: {
        /**
          * creates new objects, which will only be loaded in time (or directly if the data is available).
          * fires the "loaded" event on each object once loaded. Please note that the loaded event may be fired multiple times!
          */
        loadLazy: function (user_ids) {
            var that = this;
            var users = Ext.Array.map(user_ids, function (user_id) {return Ext.create(that, {id: user_id}); });
            var user_ids_to_lazyload = {};
            Ext.Array.each(users, function (user) {
                if (user.get('loaded')) {
                    Ext.defer(function () {user.fireEvent("loaded"); }, 1);  //first allow listeners to be attached to object
                } else {
                    user_ids_to_lazyload[user.get('id')] = user;
                }
            });
            if (user_ids_to_lazyload) {
                SOP.domain.FacebookDomain.lookupUsers(Ext.Object.getKeys(user_ids_to_lazyload), function (user_infos) {
                    Ext.Object.each(user_ids_to_lazyload, function (user_id, user) {
                        if (user_infos[user_id]) {
                            user.set('name', user_infos[user_id].name);
                            user.set('loaded', true);
                            Ext.defer(function () {user.fireEvent("loaded"); }, 1);
                        }
                    });
                });

            }
            return users;
        }
    },

    config: {
        fields: ["id", "name", "loaded"],
    }
});
