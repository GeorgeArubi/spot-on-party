/*jslint browser:true, vars: true, nomen: true */
"use strict";

if (!window.PM) {
    window.PM = {};
}

(function (PM, Backbone, $, _) {
    if (!PM.models) {
        PM.models = {};
    }
    if (!PM.collections) {
        PM.collections = {};
    }

    var enableChildTracking = function (Klass) {
        var old_extend = Klass.extend;
        Klass.__children = [];
        Klass.extend = function () {
            var That = this;
            var result = old_extend.apply(That, arguments);
            That.__children.push(result);
            result.__children = [];
            return result;
        };
    };

    enableChildTracking(Backbone.Model);

    PM.models.BaseModel = Backbone.Model.extend({
        constructor: function (attributes, options) {
            var that = this;
            Backbone.Model.apply(that, arguments);
            if (that.validate) {
                var validation_error = that.validate(that.attributes);
                if (validation_error) {
                    throw validation_error;
                }
            }
        },
    });

    PM.models.BaseModelWithoutValidationOnCreate = Backbone.Model.extend({});
    PM.models.BaseModelLazyLoad = PM.models.BaseModel.extend({
        constructor: function () {
            var that = this;
            PM.models.BaseModel.apply(that, arguments);
            if (!that.get("_status")) {
                that.set("_status", that.constructor.NOT_LOADED);
            }
            if (that.get("_status") === that.constructor.NOT_LOADED) {
                window.setTimeout(_.bind(that.lazyLoad, that), 0); // first allow the initialize to run
            }
        },

        lazyLoad: function () {
            var that = this;
            console.error("Should lazy-load: " + that.id);
        },
    }, {
    /* static members */
        NOT_LOADED: "not loaded",
        LOADED: "loaded",
        LOADING: "loading",
        ERROR: "error",

        _cache: {},

        getById: function (id) {
            var That = this;
            if (!That.getFromCache(id)) {
                That.setToCache(new That({id: id}));
            }
            return That.getFromCache(id);
        },

        getFromCache: function (id) {
            var That = this;
            return That._cache[id];
        },

        setToCache: function (object) {
            var That = this;
            if (!object instanceof That) {
                console.warn(object, That);
                throw "Object not of right class";
            }
            if (!object.id) {
                throw "Object doesn't have a valid id: " + object.id;
            }
            That._cache[object.id] = object;
        },

    });

    PM.models.User = PM.models.BaseModelLazyLoad.extend({
        defaults: {
            name: "",
            is_master: false,
        },

        actualUser: function () {
            var that = this;
            if (that.get("actual_user")) {
                return that.get("actual_user");
            }
            return that;
        },
    }, {
        getMaster: function () {
            var that = this;
            return new PM.models.User({
                id: "master",
                is_master: true,
                _status: PM.models.BaseModelLazyLoad.LOADED,
                name: PM.config.master_name,
                actual_user: that.getById(PM.app.loggedin_user_id),
            });
        }
    });

    /**
     * fields: user, joined, created, deleted
     **/
    PM.models.UserInParty = PM.models.BaseModel.extend({
        defaults: function () {
            return {
                created: new Date(),
                deleted: null,
                joined: null
            };
        },

        validate: function (attrs) {
            if (!_.isObject(attrs.user)) {
                return "Need to provide a user";
            }
            if (!_.isDate(attrs.joined) || _.isNull(attrs.joined)) {
                return "Joined needs to be a date or null";
            }
        }
    });


    PM.models.Track = PM.models.BaseModelLazyLoad.extend({
        defaults: {
            name: "",
            artist: "",
            album: "",
        },
    }, {    });

    /**
     * fields: id, track, user, deleted_by_user, created, deleted
     */
    PM.models.TrackInPlaylist = PM.models.BaseModel.extend({
        defaults: function () {
            return {
                created: new Date(),
                deleted_by_user: null,
                deleted: null,
            };
        },

        isDeleted: function () {
            var that = this;
            return _.isDate(that.get("deleted"));
        },

        validate: function (attrs) {
            if (!_.isObject(attrs.track)) {
                return "Need to provide a track";
            }
            if (!_.isObject(attrs.user)) {
                return "Need to provide a user";
            }
            if (!_.isNumber(attrs.position)) {
                return "Need to provide a position";
            }
            if (_.isObject(attrs.deleted_by_user) !== _.isDate(attrs.deleted)) {
                return "Either both or neither of deleted and deleted_by_user need to be set";
            }
        }
    });

    PM.models.Action = PM.models.BaseModelWithoutValidationOnCreate.extend({ //note: validation happens on validateAndApply
        initialize: function (attributes, options) {
            var that = this;
            that.set({
                created: new Date(),  // no default, just overwrite it
                user_id: options.user_id, // no default, just overwrite it
            }, {silent: true});
            that.party = PM.collections.Parties.getInstance().get(that.get("party_id"));
        },

        prepareValidate: function (callback) {
            window.setTimeout(callback, 0);
        },

        validateAndApplyAction: function (callback_success, callback_fail) {
            callback_success = callback_success || function (action) {console.log("new action: " + action.id + " -- " + action.constructor.type); };
            callback_fail = callback_fail || function (reason) {console.warn("creating new action failed: " + reason); };
            var that = this;
            that.prepareValidate(function () {
                if (that.validate) {
                    var validate_error = that.validate(that.attributes);
                    if (validate_error) {
                        console.warn("Action failed: " + validate_error);
                        callback_fail(validate_error);
                        return;
                    }
                }
                that.on("change", function () {throw "trying to change an action, which is not allowed"; });
                that.applyAction();
                that.id = that.party.get("log").length;
                that.party.get("log").add(that);
                callback_success(that);
            });
        },

        validate: function (attrs) {
            var that = this;
            if (!attrs.user_id) {
                return "Supply a user (owner) for this action"; // NOTE: make sure that the user_id for this action was overwritten by trusted code
            }
            if (!that.party.isMember(attrs.user_id)) {
                return "The user is not a member of the party";
            }
        },
    }, {
        createAction: function (user_or_user_id, party_or_party_id, type, properties) {
            var That = this;
            var ActionClass = _.find(That.__children, function (Action) {console.log(Action.type); return Action.type === type; });
            if (!ActionClass) {
                throw "No action class found for " + type;
            }
            var user_id = _.isNumber(user_or_user_id) ? user_or_user_id : user_or_user_id.id;
            var party_id = _.isNumber(party_or_party_id) ? party_or_party_id : party_or_party_id.id;
            return new ActionClass(_.extend({party_id: party_id}, properties || {}), {user_id: user_id});
        },

        createAndApplyAction: function (user_or_user_id, party_or_party_id, type, properties, success_callback, failure_callback) {
            var That = this;
            var action = That.createAction(user_or_user_id, party_or_party_id, type, properties);
            action.validateAndApplyAction(success_callback, failure_callback);
        }
    });

    PM.models.ChangeNameAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!_.isString(attrs.name)) {
                return "You must supply a name";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            that.party.set("name", that.get("name"));
        },
    }, {
        type: "ChangeName",
    });

    PM.models.InviteAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!attrs.invited_user_id) {
                return "invited_user_id must be present";
            }
            var user = PM.models.User.getById(that.get("invited_user_id"));
            if (user.get("status") !== "loaded") {
                return "invited user could not be loaded";
            }
            if (that.party.isMember(attrs.invited_user_id)) {
                return "user already invited";
            }
            return that.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var user = PM.models.User.getById(that.get("invited_user_id"));
            switch (user.get("status")) {
            case "error":
            case "loaded":
                that.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    user.off("change:status", handler, this);
                    that.prepareValidate(callback);
                };
                user.on("change:status", handler, this);
            }
        },

        applyAction: function () {
            var that = this;
            that.party.get("users").add({
                user: PM.models.User.getById(that.get("invited_user_id")),
            });
            // TODO: make sure the person actually gets invited (facebook message, and added to some list of open invitations
        },
    }, {
        type: "Invite",
    });

    PM.models.KickAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!attrs.kicked_user_id) {
                return "kicked_user_id must be present";
            }
            if (that.party.isMember(attrs.kicked_user_id)) {
                return "user not invited";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            var kicked_user_id = that.get("kicked_user_id");
            var record = that.party.getMemberRecord(kicked_user_id); //NOTE: validation guarantees that there is a record here
            record.set({deleted: new Date(), joined: null});
            // TODO: make sure the person actually gets kicked (removed from some list of open invitations
        },
    }, {
        type: "Kick",
    });

    PM.models.JoinAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (PM.current_patry.isJoined(attrs.user_id)) {
                return "User is already joined";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.set("joined", new Date());
        },
    });

    PM.models.LeaveAction = PM.models.Action.extend({
        type: "Leave",
        validate: function (attrs) {
            var that = this;
            if (!PM.current_patry.isJoined(attrs.user_id)) {
                return "User is not joined";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.set("joined", null);
        },
    }, {
        type: "Join",
    });

    PM.models.TrackAddAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!attrs.track_id) {
                return "track_id must be present";
            }
            var track = PM.models.Track.getById(that.get("track_id"));
            if (track.get("status") !== "loaded") {
                return "track could not be loaded";
            }
            //TODO: also check whether track is playable etc...
            return that.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var track = PM.models.Track.getById(that.get("track_id"));
            switch (track.get("status")) {
            case "error":
            case "loaded":
                that.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    track.off("change:status", handler, this);
                    that.prepareValidate(callback);
                };
                track.on("change:status", handler, this);
            }
        },

        applyAction: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            playlist.add({
                user: PM.models.User.getById(that.get("user_id")),
                track: PM.models.Track.getById(that.get("track_id")),
            });
            if (that.party.get("play_status") === "stopped") {
                that.party.trigger("play", playlist.length - 1);
            }
        },
    }, {
        type: "TrackAdd",
    });

    PM.models.TrackRemoveAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (!_.isNumber(attrs.position)) {
                return "track_id must be present";
            }
            var track_in_playlist = that.party.get("playlist").at(attrs.position);
            if (!_.isObject(track_in_playlist) || track_in_playlist.isDeleted()) {
                return "no track in the playlist at that position";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            playlist.at(that.get("position")).set({
                deleted: new Date(),
                deleted_by_user: PM.models.User.getById(that.get("user_id"))
            });
            if (that.party.get("current_playlist_index") === that.get("position")) {
                that.party.trigger("play_next");
            }
        },
    }, {
        type: "TrackRemove",
    });

    PM.models.PauseAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (that.party.get("play_status") !== "play") {
                return "can't pause when not playing";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            that.party.trigger("pause");
        },
    }, {
        type: "Pause",
    });

    PM.models.PlayAction = PM.models.Action.extend({
        validate: function (attrs) {
            var that = this;
            if (that.party.get("play_status") === "play") {
                return "already playing";
            }
            return that.__super__.validate.call(that, attrs);
        },

        applyAction: function () {
            var that = this;
            that.party.trigger("play");
        },
    }, {
        type: "Play",
    });

    /* fields: play_status, current_playlist_index, current_place_in_song */
    PM.models.PlayStatusFeedback = PM.models.BaseModel.extend({
        type: "PlayStatusFeedback",
    });

    PM.collections.Playlist = Backbone.Collection.extend({model: PM.models.TrackInPlaylist});
    PM.collections.UsersInParty = Backbone.Collection.extend({model: PM.models.UserInParty});
    PM.collections.PartyLog = Backbone.Collection.extend({model: PM.models.Actions});


    /**
     * fields: name, active, owner, playlist, users, log
     */
    PM.models.Party = PM.models.BaseModel.extend({
        defaults: function () {
            return {
                playlist: new PM.collections.Playlist(),
                users: new PM.collections.UsersInParty(),
                log: new PM.collections.PartyLog(),
                name: "",
                active: false,
                owner: null,
                play_status: "stop", //or "play" or "pause",
                current_playlist_index: -1,
                current_place_in_song: null, //when paused, contains ms after song start, when playing contains date when this song would have started had it been played in whole
                created: new Date(),
                last_updated: new Date(),
            };
        },

        initialize: function () {
            var that = this;
            PM.collections.Parties.getInstance().add(that);
            that.get("log").on("add", function () {that.set("last_updated", new Date()); });
        },

        getMemberRecord: function (user_id) {
            var that = this;
            return that.get("users").find(function (user_in_party) {
                return user_in_party.get("user").id === user_id && _.isNull(user_in_party.get("deleted"));
            });
        },

        isMember: function (user_id) {
            var that = this;
            return that.isOwner(user_id) || !!that.getMemberRecord(user_id);
        },

        isJoined: function (user_id) {
            var that = this;
            return that.get("users").any(function (user_in_party) {
                return user_in_party.get("user").id === user_id && !_.isNull(user_in_party.get("joined"));
            });
        },

        isOwner: function (user_id) {
            var that = this;
            return that.get("owner").id === user_id ||
                (that.get("owner").get("actual_user") &&
                 that.get("owner").get("actual_user").id === user_id);
        },

        /**
          * An action executed by the party owner, the master
          **/
        createAndApplyOwnAction: function (type, properies, success_callback, failure_callback) {
            var that = this;
            PM.models.Action.createAndApplyAction(PM.models.User.getMaster(), that.id, type, properies, success_callback, failure_callback);
        }
    }, {
        /* static members */
        getDefaultPartyName: function () {
            return PM.app.current_user.actualUser().get("name").toLowerCase() + "'s party";
        }
    });

    PM.collections.Parties = Backbone.Collection.extend({model: PM.models.Party}, {
        getInstance: function () {
            var That = this;
            if (!That.instance) {
                That.instance = new That();
            }
            return That.instance;
        }
    });

}(window.PM, window.Backbone, window.$, window._));


