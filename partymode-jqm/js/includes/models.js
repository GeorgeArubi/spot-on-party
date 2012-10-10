/*jshint */
/*global exports, require*/

var root = this;
var _ = root._;
var Backbone = root.Backbone;
var clutils = root.clutils;
var PM = root.PM;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    if (!Backbone) {Backbone = require("./backbone"); }
    if (!clutils) {clutils = require("./clutils"); }
    PM = exports;
    PM.config = require("./config");
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!Backbone) {throw "Backbone not loaded"; }
    if (!clutils) {throw "clutils not loaded"; }
    if (!PM) {
        PM = {};
    }
}


(function (PM) {
    "use strict";
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
        idAttribute: "_id",
        _fields: {_id: 1},
        _validate_on_creation: true,

        constructor: function () {
            var that = this;
            if (!that.constructor.type) {
                throw "Object without type";
            }
            that.heritage = [that.constructor];
            while ("__super__" in _.last(that.heritage)) {
                that.heritage.push(_.last(that.heritage).__super__.constructor);
            }

            that._all_fields = _.extend.apply(that, _.map(that.heritage, function (Klass) {return Klass.prototype._fields || {}; }).reverse());

            Backbone.Model.apply(that, arguments);
            if (that._validate_on_creation) {
                if (that.validate) {
                    var validation_error = that.validate(that.attributes);
                    if (validation_error) {
                        throw validation_error;
                    }
                }
            }
        },

        serializeAllButId: function () {
            var that = this;
            var fields = _.keys(that._all_fields);
            delete fields._id;
            return _.pick(that.attributes, fields);
        },

        get: function (attribute) {
            var that = this;
            if (!(attribute in that._all_fields)) {
                throw "Object \"" + that.constructor.type + "\" doesn't have field \"" + attribute + "\"";
            }
            return Backbone.Model.prototype.get.apply(that, arguments);
        },

        set: function (attribute) {
            var that = this;
            if (!_.isNull(attribute)) {
                var keys = (_.isObject(attribute) ? _.keys(attribute) : [attribute]);
                _.each(keys, function (key) {
                    if (!(key in that._all_fields)) {
                        throw "Object \"" + that.constructor.type + "\" doesn't have field \"" + key + "\"";
                    }
                });
            }
            return Backbone.Model.prototype.set.apply(that, arguments);
        }
    });

    PM.models.BaseModelLazyLoad = PM.models.BaseModel.extend({
        _fields: {
            _status: 1,
        },

        constructor: function () {
            var that = this;
            PM.models.BaseModel.apply(that, arguments);
            if (!that.get("_status")) {
                that.set("_status", that.constructor.NOT_LOADED);
            }
            if (that.get("_status") === that.constructor.NOT_LOADED) {
                _.delay(_.bind(that.lazyLoad, that), 0); // first allow the initialize to run
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

        getById: function (id, loaded_callback, error_callback) {
            var That = this;
            if (!That.getFromCache(id)) {
                That.setToCache(new That({_id: id}));
            }
            var object = That.getFromCache(id);
            var checkloaded;
            checkloaded = function () {
                if (object.get("_status") === That.LOADED) {
                    object.off("change", checkloaded);
                    if (_.isFunction(loaded_callback)) {
                        loaded_callback(object);

                    }
                } else if (object.get("_status") === That.ERROR) {
                    object.off("change", checkloaded);
                    if (_.isFunction(error_callback)) {
                        error_callback(object);
                    }
                }
            };
            if (_.isFunction(loaded_callback) || _.isFunction(error_callback)) {
                object.on("change:_status", checkloaded);
            }
            return object;
        },

        getFromCache: function (id) {
            var That = this;
            return That._cache[id];
        },

        //TODO figure out if That._cache is shared by all BaseModelLazyLoads
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
        _fields: {
            name: 1,
            is_master: 1,
        },

        defaults: {
            name: "",
            is_master: false,
        },

        getProfilePictureUrl: function () {
            var that = this;
            return PM.domain.FacebookDomain.getProfilePictureUrl(that.id);
        },

    }, {
        type: "User",
        MASTER_ID: "master",

        getByFacebookData: function (facebookdata) {
            var That = this;
            clutils.checkConstraints(facebookdata, {id: {_isNumeric: true}, name: {_isString: true}});
            var newdata = _.extend({_status: That.LOADED, _id: parseInt(facebookdata.id, 10)}, _.omit(facebookdata, "id"));
            var user = new That(newdata);
            That.setToCache(user);
            return user;
        },

        getAllFriendsOfLoggedinUser: function (callback) {
            var That = this;
            PM.domain.FacebookDomain.getAllFriends(function (friends_data) {
                callback(_.map(_.sortBy(friends_data, "name"), function (friend_data) {
                    return That.getByFacebookData(friend_data);
                }));
            });
        }
    });

    PM.models.User.setToCache(new PM.models.User({
        _id: PM.models.User.MASTER_ID,
        name: PM.config.master_name,
        _status: PM.models.User.LOADED,
    }));

    PM.models.UserInParty = PM.models.BaseModel.extend({
        _fields: {
            user_id: 1,
            joined: 1,
            created: 1,
            deleted: 1,
            active: 1,
        },
        
        defaults: function () {
            return {
                joined: null,
                deleted: null,
            };
        },

        serialize: function () {
            var that = this;
            return that.serializeAllButId();
        },

        wasKicked: function () {
            var that = this;
            return clutils.isTimestamp(that.get("deleted"));
        },

        validate: function (attrs) {
            if (!_.isNumber(attrs.user_id)) {
                return "Need to provide a user_id";
            }
            if (!(clutils.isTimestamp(attrs.created))) {
                return "Created needs to be a date " + JSON.stringify(attrs.created);
            }
            if (!(clutils.isTimestamp(attrs.active))) {
                return "Active needs to be a date";
            }
            if (!(clutils.isTimestamp(attrs.joined) || _.isNull(attrs.joined))) {
                return "Joined needs to be a date or null";
            }
        },
        
        didAction: function (when) {
            var that = this;
            that.set("active", when);
        }
    }, {
        type: "UserInParty",

        unserialize: function (data) {
            var That = this;
            return new That(_.omit(data, '_id'));
        },
    });


    PM.models.Track = PM.models.BaseModelLazyLoad.extend({
        _fields: {
            name: "",
            artist: "",
            album: "",
            duration: "",
        },
    }, {
        type: "Track",
    });

    PM.models.TrackInPlaylist = PM.models.BaseModel.extend({
        _fields: {
            track_id: 1,
            user_id: 1,
            deleted_by_user_id: 1,
            created: 1,
        },

        defaults: function () {
            return {
                deleted_by_user_id: 0,
            };
        },

        serialize: function () {
            var that = this;
            return that.serializeAllButId();
        },

        isDeleted: function () {
            var that = this;
            return !!that.get("deleted_by_user_id");
        },

        getTrack: function () {
            var that = this;
            return PM.models.Track.getById(that.get("track_id"));
        },

        getUser: function () {
            var that = this;
            return PM.models.User.getById(that.get("user_id"));
        },

        getDeletedByUser: function () {
            var that = this;
            if (!that.get("deleted_by_user_id")) {
                return null;
            }
            return PM.models.User.getById(that.get("deleted_by_user_id"));
        },

        validate: function (attrs) {
            if (!_.isString(attrs.track_id)) {
                return "Need to provide a track_id";
            }
            if (!_.isNumber(attrs.user_id) && attrs.user_id !== PM.models.User.MASTER_ID) {
                return "Need to provide a user_id";
            }
            if (!(clutils.isTimestamp(attrs.created))) {
                return "Created needs to be a date";
            }
        }
    }, {
        type: "TrackInPlaylist",

        unserialize: function (data) {
            var That = this;
            return new That(_.omit(data, '_id'));
        },
    });

    PM.models.Action = PM.models.BaseModel.extend({ //note: validation happens on validateAndApply
        _validate_on_creation: false,
        _fields: {
            created: 1,
            user_id: 1,
            party_id: 1,
            number: 1,
        },

        defaults: function () {
            return {
                created: clutils.nowts(),
            };
        },

        initialize: function (attributes, options) {
            var that = this;
            that.set({
                user_id: options.user_id, // no default, just overwrite it
            }, {silent: true});
            that.party = PM.collections.Parties.getInstance().get(that.get("party_id"));
        },

        prepareValidate: function (callback) {
            _.delay(callback, 0);
        },

        validateAndApplyAction: function (callback_success, callback_fail) {
            callback_success = callback_success || function (action) {console.log("new action: " + action.get("number") + " -- " + action.constructor.type); };
            callback_fail = callback_fail || function (reason) {throw "creating new action failed: " + reason; };
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
                that.applyValidatedAction();
                callback_success(that);
            });
        },

        applyValidatedAction: function () {
            var that = this;
            if (that.get("number") && that.get("number") !== that.party.get("log").length + 1) {
                throw "action has number " + that.get("number") + " but party expects number " + (that.party.get("log").length + 1);
            } else {
                that.set("number", that.party.get("log").length + 1);
                that.on("change", function () {throw "trying to change an action, which is not allowed"; });
                that.applyActionToParty();
                that.party.get("log").add(that);
            }
        },

        validate: function (attrs) {
            var that = this;
            if (!attrs.user_id) {
                return "Supply a user (owner) for this action"; // NOTE: make sure that the user_id for this action was overwritten by trusted code
            }
            if (!that.party) {
                return "Party could not be loaded";
            }
            if (!that.party.isOwner(attrs.user_id) && !that.party.isMember(attrs.user_id)) {
                return "The user is not a member of the party";
            }
        },

        serialize: function () {
            var that = this;
            return _.extend({_TYPE: that.constructor.type}, that.serializeAllButId());
        }
    }, {
        unserializeFromTrusted: function (data) {
            var That = this;
            var ActionClass = _.find(That.__children, function (Action) {return Action.type === data._TYPE; });
            if (!ActionClass) {
                throw "No action class found for " + data._TYPE;
            }
            var mydata = _.clone(data);
            delete mydata._TYPE;
            return new ActionClass(mydata, {user_id: mydata.user_id});
        },

        createAction: function (user_or_user_id, party_or_party_id, type, properties) {
            var That = this;
            var ActionClass = _.find(That.__children, function (Action) {return Action.type === type; });
            if (!ActionClass) {
                throw "No action class found for " + type;
            }
            var user_id = _.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id;
            var party_id = _.isObject(party_or_party_id) ? party_or_party_id.id : party_or_party_id;
            return new ActionClass(_.extend({party_id: party_id}, properties || {}), {user_id: user_id});
        },

        createAndApplyAction: function (user_or_user_id, party_or_party_id, type, properties, success_callback, failure_callback) {
            var That = this;
            var action = That.createAction(user_or_user_id, party_or_party_id, type, properties);
            action.validateAndApplyAction(success_callback, failure_callback);
        }
    });

    PM.models.ChangeNameAction = PM.models.Action.extend({
        _fields: {
            name: 1,
        },

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

        applyActionToParty: function () {
            var that = this;
            that.party.set("name", that.get("name"));
        },
    }, {
        type: "ChangeName",
    });

    PM.models.InviteAction = PM.models.Action.extend({
        _fields: {
            invited_user_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (!attrs.invited_user_id) {
                return "invited_user_id must be present";
            }
            var user = PM.models.User.getById(that.get("invited_user_id"));
            if (user.get("_status") !== "loaded") {
                return "invited user could not be loaded";
            }
            if (that.party.isMember(attrs.invited_user_id)) {
                return "user already invited";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var user = PM.models.User.getById(that.get("invited_user_id"));
            switch (user.get("_status")) {
            case "error":
            case "loaded":
                that.constructor.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    user.off("change:_status", handler, this);
                    that.prepareValidate(callback);
                };
                user.on("change:_status", handler, this);
            }
        },

        applyActionToParty: function () {
            var that = this;
            that.party.get("users").add(new PM.models.UserInParty({
                user_id: that.get("invited_user_id"),
                created: that.get("created"),
                active: that.get("created"),
            }));
        },
    }, {
        type: "Invite",
    });

    PM.models.KickAction = PM.models.Action.extend({
        _fields: {
            kicked_user_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!that.party.isOwner(attrs.user_id)) {
                return "Only owner can do this";
            }
            if (that.party.isOwner(attrs.kicked_user_id)) {
                return "The owner of the party can't be kicked";
            }
            if (!attrs.kicked_user_id) {
                return "kicked_user_id must be present";
            }
            if (!that.party.isMember(attrs.kicked_user_id)) {
                return "user not invited";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var kicked_user_id = that.get("kicked_user_id");
            var record = that.party.getMemberRecord(kicked_user_id); //NOTE: validation guarantees that there is a record here
            record.set({deleted: that.get("created"), joined: null}); //obviously not setting "active"
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
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.set({"joined": that.get("created"), active: that.get("created")});
        },
    });

    PM.models.LeaveAction = PM.models.Action.extend({
        type: "Leave",
        validate: function (attrs) {
            var that = this;
            if (!PM.current_patry.isJoined(attrs.user_id)) {
                return "User is not joined";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var record = that.party.getMemberRecord(that.get("user_id")); //NOTE: validation guarantees that there is a record here
            record.set("joined", null); //obviously not setting "active"
        },
    }, {
        type: "Join",
    });

    PM.models.TrackAddAction = PM.models.Action.extend({
        _fields: {
            track_id: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!attrs.track_id) {
                return "track_id must be present";
            }
            var track = PM.models.Track.getById(that.get("track_id"));
            if (track.get("_status") !== "loaded") {
                return "track could not be loaded";
            }
            //TODO: also check whether track is playable etc...
            return that.constructor.__super__.validate.call(that, attrs);
        },

        prepareValidate: function (callback) {
            var that = this;
            var track = PM.models.Track.getById(that.get("track_id"));
            switch (track.get("_status")) {
            case "error":
            case "loaded":
                that.constructor.__super__.prepareValidate.call(that, callback);
                break;
            default:
                var handler;
                handler = function () {
                    track.off("change:_status", handler, this);
                    that.prepareValidate(callback);
                };
                track.on("change:_status", handler, this);
            }
        },

        applyActionToParty: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            playlist.add(new PM.models.TrackInPlaylist({
                user_id: that.get("user_id"),
                track_id: that.get("track_id"),
                created: this.get("created"),
            }));

            that.party.getMemberRecord(that.get("user_id")).didAction(that.get("created"));
            if (that.party.get("play_status") === "stop") {
                that.party.trigger("playcommand", "play", playlist.length - 1);
            }
        },
    }, {
        type: "TrackAdd",
    });

    PM.models.TrackRemoveAction = PM.models.Action.extend({
        _fields: {
            position: 1,
        },

        validate: function (attrs) {
            var that = this;
            if (!_.isNumber(attrs.position)) {
                return "position must be present";
            }
            var track_in_playlist = that.party.get("playlist").at(attrs.position);
            if (!_.isObject(track_in_playlist) || track_in_playlist.isDeleted()) {
                return "no track in the playlist at that position";
            }
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            var playlist = that.party.get("playlist");
            playlist.at(that.get("position")).set({
                deleted_by_user_id: that.get("user_id")
            });
            if (that.party.get("current_playlist_index") === that.get("position")) {
                that.party.trigger("playcommand", "play_next");
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
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.trigger("playcommand", "pause");
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
            return that.constructor.__super__.validate.call(that, attrs);
        },

        applyActionToParty: function () {
            var that = this;
            that.party.trigger("playcommand", "play");
        },
    }, {
        type: "Play",
    });

    /* perhaps not really an action, but just nicer if it pretends to be one :) */
    PM.models.PlayStatusFeedbackAction = PM.models.Action.extend({
        _fields: {
            play_status: 1, // one of: play, pause or stop
            current_playlist_index: 1, // in TrackIn_playlist playlist, not spotify playlist
            current_place_in_track: 1, // see comment in Party
            created: 1,
        },

        defaults: function () {
            return {
                created: clutils.nowts(),
            };
        },

        validate: function (attrs) {
            if (attrs.play_status !== "play" && attrs.play_status !== "stop" && attrs.play_status !== "pause") {
                return "No valid play status: \"" + attrs.play_status + "\"";
            }
            if (attrs.play_status === "pause" && !_.isNumber(attrs.current_place_in_track)) {
                return "Expected a number for current_place_in_track";
            }
            if (attrs.play_status === "play" && !clutils.isTimestamp(attrs.current_place_in_track)) {
                return "Expected a date for current_place_in_track";
            }
        },

        applyActionToParty: function () {
            var that = this;
            that.party.set({
                play_status: that.get("play_status"),
                current_playlist_index: that.get("current_playlist_index"),
                current_place_in_track: that.get("current_place_in_track"),
            });
        },
    }, {
        type: "PlayStatusFeedback",
    });

    PM.models.DummyAction = PM.models.Action.extend();

    PM.collections.Playlist = Backbone.Collection.extend({model: PM.models.TrackInPlaylist});
    PM.collections.UsersInParty = Backbone.Collection.extend({model: PM.models.UserInParty});
    PM.collections.PartyLog = Backbone.Collection.extend({model: PM.models.Actions});


    PM.models.Party = PM.models.BaseModel.extend({
        _fields: {
            playlist: 1,
            users: 1,
            log: 1,
            name: 1,
            active: 1,
            owner_id: 1,
            play_status: 1,
            current_playlist_index: 1,
            current_place_in_track: 1,
            created: 1,
            last_updated: 1,
        },

        defaults: function () {
            return {
                playlist: new PM.collections.Playlist(),
                users: new PM.collections.UsersInParty(),
                log: new PM.collections.PartyLog(),
                name: "",
                active: false,
                owner_id: 0,
                play_status: "stop", //or "play" or "pause",
                current_playlist_index: -1,
                current_place_in_track: null, //when paused, contains ms after track start, when playing contains date when this song would have started had it been played in whole
                created: clutils.nowts(),
                last_updated: clutils.nowts(),
            };
        },

        serialize: function () {
            var that = this;
            return {
                _id: that.id,
                name: that.get("name"),
                active: that.get("active"),
                owner_id: that.get("owner_id"),
                play_status: that.get("play_status"),
                current_playlist_index: that.get("current_playlist_index"),
                current_place_in_track: that.get("current_place_in_track"),
                created: that.get("created"),
                last_updated: that.get("last_updated"),
                playlist: that.get("playlist").map(function (track_in_playlist) {return track_in_playlist.serialize(); }),
                users: that.get("users").map(function (user_in_party) {return user_in_party.serialize(); }),
                log: that.get("log").length,
            };
        },

        /* returns the object that we want to index in mongo */
        indexableObject: function () {
            var that = this;
            return {
                _id: that.id,
                name: that.get("name"),
                active: that.get("active"),
                owner_id: that.get("owner_id"),
                created: that.get("created"),
                last_updated: that.get("last_updated"),
                track_ids: that.get("playlist").filter(function (track_in_playlist) {return !track_in_playlist.isDeleted(); }).pluck("track_id"),
                user_ids: that.get("users").filter(function (user_in_party) {return !user_in_party.wasKicked(); }).pluck("user_id"),
            };
        },

        initialize: function () {
            var that = this;
            that.get("log").on("add", function (action) {
                if (clutils.isTimestamp(action.get("created"))) {
                    that.set("last_updated", action.get("created"));
                }
            });
        },

        getMemberRecord: function (user_or_user_id) {
            var that = this;
            var user_id_to_check = (_.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id);
            if (user_id_to_check === PM.models.User.MASTER_ID) {
                return that.getMemberRecord(that.get("owner_id"));
            }
            return that.get("users").find(function (user_in_party) {
                return user_in_party.get("user_id") === user_id_to_check && _.isNull(user_in_party.get("deleted"));
            });
        },

        isMember: function (user_or_user_id) {
            var that = this;
            return !!that.getMemberRecord(user_or_user_id);
        },

        getMembersInPartyOrderedByActive: function () {
            var that = this;
            return _.chain(that.get("users").toArray())
                .filter(function (user_in_party) {return _.isNull(user_in_party.get("deleted")); })
                .sortBy(function (user_in_party) {return user_in_party.get("active"); })
                .reverse()
                .value();
        },

        isJoined: function (user_or_user_id) {
            var that = this;
            var user_in_party = that.getMemberRecord(user_or_user_id);
            return (!!user_in_party) && !!user_in_party.get("joined");
        },

        isOwner: function (user_or_user_id) {
            var that = this;
            var user_id_to_check = (_.isObject(user_or_user_id) ? user_or_user_id.id : user_or_user_id);
            return PM.models.User.MASTER_ID === user_id_to_check || that.get("owner_id") === user_id_to_check;
        },

        /**
         * sort of subjective idea of whether a party is new...
         */
        isNew: function () {
            var that = this;
            return (that.get("log").length < 3 && //new party has changename and invite of owner action
                    (clutils.nowts() - that.get("created") < 60)); //created less than one minute ago
        },

        /**
          * An action executed by the party owner, the master
          **/
        createAndApplyMasterAction: function (type, properties, success_callback, failure_callback) {
            var that = this;
            PM.models.Action.createAndApplyAction(PM.models.User.MASTER_ID, that.id, type, properties, success_callback, failure_callback);
        },

        applyPlayStatusFeedback: function (play_status, current_playlist_index, current_place_in_track) {
            var that = this;
            var data = {
                play_status: play_status,
                current_playlist_index: current_playlist_index,
                current_place_in_track: current_place_in_track,
            };
            PM.models.Action.createAndApplyAction(PM.models.User.MASTER_ID, that.id, "PlayStatusFeedback", data);
        },

        validate: function (attrs) {
            if (attrs.play_status !== "play" && attrs.play_status !== "stop" && attrs.play_status !== "pause") {
                return "No valid play status: \"" + attrs.play_status + "\"";
            }
        },

        shareNewActions: function () {
            var that = this;
            that.get("log").on("add", function (action) {
                PM.domain.PartyNodeDomain.shareAction(action.serialize());
            });
        },


    }, {
        type: "Party",
        
        getDefaultPartyName: function (owner) {
            return owner.get("name").toLowerCase() + "'s party";
        },

        unserialize: function (data) {
            var That = this;
            var party = new That({
                id: data._id,
                name: data.name,
                active: data.active,
                owner: data.owner,
                play_status: data.play_status,
                current_playlist_index: data.current_playlist_index,
                current_place_in_track: data.current_place_in_track,
                created: data.created,
                last_updated: data.last_updated,
            });
            party.get("playlist").add(_.map(data.playlist, function (track_in_playlist_data) {return PM.models.TrackInPlaylist.unserialize(track_in_playlist_data); }));
            party.get("users").add(_.map(data.users, function (user_in_party_data) {return PM.models.UserInParty.unserialize(user_in_party_data); }));
            party.get("log").add(_.map(_.range(data.log), function (undefined) {return new PM.models.DummyAction(); }));
            return party;
        },
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

    PM.util = PM.util || {};

    PM.collections.Users = Backbone.Collection.extend({
        model: PM.models.User,
    });

}(PM));


