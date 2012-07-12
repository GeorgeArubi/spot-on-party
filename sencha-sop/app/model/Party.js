/*jslint sloppy: true, vars:true, bitwise:true, plusplus: true  */
/*globals Ext, SOP*/

Ext.define("SOP.model.Party", {
    extend: "Ext.data.Model",
    requires: ["SOP.model.Track", "SOP.model.User", "SOP.model.PlaylistEntry", "SOP.domain.SopBaseDomain", "Ext.Array"],

    config: {
        playlistEntryStore: null,
        userInPartyStore: null,
        fields: [
            'id',
            "name",
            "active",
            "owner_id",
            "log",
        ],
    },

    statics: {
        loadOwnedParties: function (callback) {
            var that = this;
            SOP.domain.SopBaseDomain.getOwnedParties(function (party_infos) {
                callback(Ext.Array.map(party_infos, function (party_info) {
                    return Ext.create(that, party_info);
                }));
            });
        },
        loadActivePartiesForLoggedinUser: function (callback) {
            var that = this;
            SOP.domain.SopBaseDomain.getActiveParties(function (party_infos) {
                callback(Ext.Array.map(party_infos, function (party_info) {
                    return Ext.create(that, party_info);
                }));
            });
        },
        loadCached: function (party_id, callback) {
            var that = this;
            var cachedParty =  Ext.data.Model.cache[Ext.data.Model.generateCacheId(that.getName(), party_id)];
            if (cachedParty) {
                var party = Ext.create(that, {}, party_id);
                callback(party);
            } else {
                SOP.domain.SopBaseDomain.getParty(party_id, function (party_info) {
                    if (!party_info) {
                        callback(null);
                        return;
                    }
                    var party = Ext.create(that, party_info);
                    if (!party.get('active')) {
                        callback(null);
                        return;
                    }
                    callback(party);
                });
            }
        },
        /**
         * loads a single party (when party is not active or loggedin user is not invited "null" is returned
         * afterwards starts following the party, by retrieving 
         */
        loadOwnAndActivate: function (party_id, callback) {
            var that = this;
            that.loadCached(party_id, function (party) {
                if (party && party.get('owner_id') === SOP.domain.FacebookDomain.getLoggedinUserId()) {
                    party.startFollowing();
                    party.getAndFeedActions(function () {
                        party.activate(function () {
                            callback(party);
                        });
                    });
                } else {
                    callback(null);
                }
            });
        },
        /**
         * loads a single party (when party is not active or loggedin user is not invited "null" is returned
         * afterwards starts following the party, by retrieving 
         */
        loadActiveAndFollow: function (party_id, callback) {
            var that = this;
            that.loadCached(party_id, function (party) {
                if (party && party.get('active')) {
                    party.startFollowing();
                    party.getAndFeedActions(function () {
                        callback(party);
                    });
                } else {
                    callback(null);
                }
            });
        },

        create: function (name, callback) {
            var that = this;
            var used_name = (name.trim() === "" ? "---" : name);
            SOP.domain.SopBaseDomain.createParty(used_name, function (party_info) {
                var party = Ext.create(that, party_info);
                party.getAndFeedActions(function () {
                    callback(party);
                });
            });
        },

        ACTIVE_OFF: 1,
        ACTIVE_ON: 2,
    },

    init: function () {
        var that = this;
        that.setPlaylistEntryStore(Ext.create("Ext.data.Store", {
            model: "SOP.model.PlaylistEntry",
            data: [],
            sorters: [{property: "position", direction: "ASC"}],
            listeners: {
                // this is needed because the playlistentry contains other objects, and in those cases the stores don't
                // get notified of the update
                addrecords: function (store, records) {
                    var that = this;
                    Ext.each(records, function (playlistEntry) {
                        var storeInteface = {
                            afterEdit: function () { store.afterEdit(playlistEntry, ['track', 'user'], {}); },
                            afterCommit: function () { },
                            afterErase: function () { },
                        };
                        playlistEntry.get('track').join(storeInteface);
                        playlistEntry.get('user').join(storeInteface);
                    });
                }
            }
        }));
        that.setUserInPartyStore(Ext.create("Ext.data.Store", {
            model: "SOP.model.UserInParty",
            data: [],
            sorters: [
                {property: "is_owner", direction: "DESC"},
                {property: "joined", direction: "DESC"},
                {property: "created", direction: "ASC"},
            ],
            listeners: {
                // this is needed because the playlistentry contains other objects, and in those cases the stores don't
                // get notified of the update
                addrecords: function (store, records) {
                    var that = this;
                    Ext.each(records, function (userInParty) {
                        var storeInteface = {
                            afterEdit: function () { store.afterEdit(userInParty, ['user'], {}); },
                            afterCommit: function () { },
                            afterErase: function () { },
                        };
                        userInParty.get('user').join(storeInteface);
                    });
                }
            }
        }));
        var defaultlog =
            [{
                action: {type: null},
                party_state: {
                    owner_id: null,
                    name: null,
                    invited_user_ids: {},
                    joined_user_ids: {},
                    playlist_entries: [],
                    active: 1, //ACTIVE_OFF, can't use static yes because it hasn't been defined yet
                }
            }];
        that.set('log', defaultlog);
    },

    toUrl: function () {
        return "party/" + this.get('id');
    },

    /**
     * tells us up until where we've recieved all actions
     */
    calculateLastActionId: function () {
        var party_log = this.get('log'), i;
        for (i = 1; i < party_log.length; i++) {
            if (!party_log[i] || !party_log[i].action) {
                break;
            }
        }
        return i - 1;
    },

    loggedinUserIsAdmin: function () {
        var that = this;
        return (SOP.domain.FacebookDomain.getLoggedinUserId() === that.get('owner_id'));
    },

    getAndFeedActions: function (callback) {
        var that = this;
        SOP.domain.SopBaseDomain.getActions(this.get('id'), this.calculateLastActionId(), function (actions) {
            that.feed(actions);
            if (callback) {
                callback();
            }
        });
    },

    inviteUsers: function (user_ids, callback) {
        var that = this;
        SOP.domain.SopBaseDomain.inviteUsers(that.get('id'), user_ids, function (actions) {
            that.feed(actions);
            if (callback) {
                callback();
            }
        });
    },

    activate: function (callback) {
        var that = this;
        SOP.domain.SopBaseDomain.activate(that.get('id'), function (actions) {
            that.feed(actions);
            callback();
        });
    },

    deactivate: function (callback) {
        var that = this;
        SOP.domain.SopBaseDomain.deactivate(that.get('id'), function (actions) {
            that.feed(actions);
            if (callback) {
                callback();
            }
        });
    },

    startFollowing: function () {
        var that = this;
        SOP.domain.SopBaseDomain.joinParty(that.get('id'), that.feed, that);
    },

    stopFollowing: function () {
        var that = this;
        SOP.domain.SopBaseDomain.leaveParty(that.get('id'), that.feed, that);
    },

    getPartyState: function () {
        var party_log = this.get('log'), i;
        for (i = party_log.length - 1; i > 0; i--) {
            if (party_log[i] && party_log[i].party_state) {
                return party_log[i].party_state;
            }
        }
    },

    feed: function (actions) {
        var party_log = this.get('log'), lowest_changed = party_log.length, i, new_items = {};
        var commands = [];
        Ext.Array.each(actions, function (action) {
            if (party_log[action.nr]) {
                return; //already fed
            }
            party_log[action.nr] = {action: action};
            new_items[action.nr] = true;
            lowest_changed = Math.min(lowest_changed, action.nr);
        });
        this.set('log', party_log);
        for (i = lowest_changed; i < party_log.length; i++) {
            var command = this.recalculateParty(i, !!new_items[i]);
            if (command) {
                commands.push(command);
            }
        }
        var party_state = this.getPartyState();
        if (this.get('name') !== party_state.name) {
            this.set('name', party_state.name);
            this.fireEvent("namechanged");
        }
        if (this.get('active') !== (party_state.active === this.self.ACTIVE_ON)) {
            this.set('active', (party_state.active === this.self.ACTIVE_ON));
            this.fireEvent("activechanged");
        }
        this.set('owner_id', party_state.owner.get('id'));
        this.fireEvent("fed");
        if (commands.length > 0) {
            this.fireEvent("commands", commands);
        }
    },

    recalculateParty: function (position, is_new) {
        //assert: position > 0
        var that = this;
        var party_log = this.get('log');
        var command = null;
        if (!party_log[position]) {
            party_log[position] = {}; // create dummy entry when actions arrive out of order
        }
        var action = party_log[position].action;
        var party_state = Ext.clone(party_log[position - 1].party_state);
        party_log[position].party_state = party_state;
        if (action) {
            switch (action.type) {
            case "PartyCreateAction":
                party_state.active = this.self.ACTIVE_ON;
                party_state.name = action.name;
                party_state.owner = SOP.model.User.loadLazy([action.user_id])[0];
                break;
            case "PartyChangeNameAction":
                party_state.name = action.name;
                break;
            case "PartyInviteAction":
                if (party_state.invited_user_ids[action.invited_user_id]) {
                    party_state.invited_user_ids[action.invited_user_id].set('deleted', action.created);
                }
                party_state.invited_user_ids[action.invited_user_id] = Ext.create("SOP.model.UserInParty", {
                    user: SOP.model.User.loadLazy([action.invited_user_id])[0],
                    party: that,
                    created: action.created,
                    joined: false,
                    is_owner: action.invited_user_id === that.get("owner_id"),
                });
                if (is_new) {
                    that.getUserInPartyStore().add(party_state.invited_user_ids[action.invited_user_id]);
                }
                break;
            case "PartyKickAction":
                if (party_state.invited_user_ids[action.kicked_user_id]) {
                    party_state.invited_user_ids[action.kicked_user_id].set('deleted', action.created);
                    delete party_state.invited_user_ids[action.kicked_user_id];
                }
                break;
            case "PartyJoinedAction":
                if (party_state.invited_user_ids[action.user_id]) {
                    party_state.invited_user_ids[action.user_id].set('joined', true);
                }
                break;
            case "PartyLeftAction":
                if (party_state.invited_user_ids[action.user_id]) {
                    party_state.invited_user_ids[action.user_id].set('joined', false);
                }
                break;
            case "PartySongAddAction":
                var playlist_entry = Ext.create("SOP.model.PlaylistEntry", {
                    id: this.get('id') + "_" + action.nr, //makes sure that the object is reused and updated if it already exists
                    track: SOP.model.Track.loadLazy([action.song_id])[0],
                    user: SOP.model.User.loadLazy([action.user_id])[0],
                    created: action.created,
                    deleted: null,
                    deleted_by_user: null,
                    is_playing: false,
                    position: party_state.playlist_entries.length,
                });
                party_state.playlist_entries.push(playlist_entry);
                if (is_new) {
                    //add the record to the store
                    this.getPlaylistEntryStore().add(playlist_entry);
                }
                break;
            case "PartySongRemoveAction":
                party_state.playlist_entries[action.position].set({
                    deleted_by_user: SOP.model.User.loadLazy([action.user_id])[0],
                    deleted: action.created,
                });
                break;
            case "PartyPositionPlayAction":
                if (is_new) {
                    command = {type: "playposition", position: action.position};
                }
                break;
            case "PartyPlayStatusUpdateAction":
                Ext.each(party_state.playlist_entries, function (playlistEntry) {
                    var is_playing = (playlistEntry.get('position') === action.position);
                    if (playlistEntry.get('is_playing') !== is_playing) {
                        playlistEntry.set('is_playing', is_playing);
                    }
                });
                break;
            case "PartyOnAction":
                party_state.active = this.self.ACTIVE_ON;
                break;
            case "PartyOffAction":
                party_state.active = this.self.ACTIVE_OFF;
                break;
            default:
                console.log("Don't know how to handle action type " + action.type + " at position " + position, party_log);
                throw "Don't know how to handle action type " + action.type;
            }
        }
        this.set('log', party_log);
        return command;
    },

});
