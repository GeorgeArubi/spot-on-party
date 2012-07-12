/*jslint vars: true,*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.User", {
    extend: "SOP.model.LazyBaseModel",


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
                } else if (user.get('loading')) {
                    // Already loading
                    var x = "do nothing";
                } else {
                    user_ids_to_lazyload[user.get('id')] = user;
                }
            });
            if (Ext.Object.getSize(user_ids_to_lazyload) > 0) {
                //TODO: avoid thundering herd
                Ext.Object.each(user_ids_to_lazyload, function (user_id, user) {
                    user.set('loading', true);
                });
                SOP.domain.FacebookDomain.lookupUsers(Ext.Object.getKeys(user_ids_to_lazyload), function (user_infos) {
                    Ext.Object.each(user_ids_to_lazyload, function (user_id, user) {
                        if (user_infos[user_id]) {
                            user.set('name', user_infos[user_id].name);
                            user.set('loaded', true);
                            user.set('loading', false);
                            Ext.defer(function () {user.fireEvent("loaded"); }, 1);
                        }
                    });
                });

            }
            return users;
        },
        /**
          * Loads all facebook friends for the loggedin user
          **/
        loadAllFriends: function (callback) {
            var that = this;
            SOP.domain.FacebookDomain.getAllFriends(function (users_info) {
                var users = Ext.Array.map(users_info, function (user_info) {
                    return Ext.create(that, Ext.merge(user_info, {loaded: true}));
                });
                callback(users);
            });
        },
    },

    config: {
        fields: ["id", "name", "loaded", "loading"],
    },

    getProfilePictureUrl: function () {
        return SOP.domain.FacebookDomain.getProfilePictureUrl(this.get('id'));
    },

});
