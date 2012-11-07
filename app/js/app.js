/*jshint browser: true*/
/*global clutils, _, $, Backbone, Toolbox */

window.PM = window.PM || {};
window.PM.app = window.PM.app || {};

(function (PM) {
    "use strict";
    var LoginView, PartyOverviewView, OldPartyView, PartyView;

    var getTemplate = function (id) {
        var template = PM.templates[id];
        if (!_.isFunction(template)) {
            throw "Template '" + id + "' not found";
        }
        return template;
    };

    var createAndRenderViewLoggedin = function () {
        var createAndRenderViewArguments = arguments;
        if (PM.app.loggedin_user) {
            createAndRenderView.apply(this, createAndRenderViewArguments);
        } else {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.domain.FacebookDomain.getLoggedinUserId(function (user_id) {
                        PM.app.loggedin_user = PM.models.User.getById(user_id); // will lazy-load, which is fine I think
                        PM.domain.FacebookDomain.getAccessToken(function (accessToken) {
                            PM.domain.PartyNodeDomain.connect(accessToken, false, function () {
                                PM.domain.FacebookDomain.on("new token", function (token) {
                                    PM.domain.PartyNodeDomain.updateToken(token);
                                });
                                createAndRenderView.apply(this, createAndRenderViewArguments);
                            });
                        });
                    });
                } else {
                    $.mobile.changePage("#login");
                }
            });
        }
    };

    var activeParties = new PM.collections.Parties();
    PM.domain.PartyNodeDomain.on("connection", function () {
        activeParties.reset([]);
    });
    PM.domain.PartyNodeDomain.on("plus-active-party", function (party_data) {
        activeParties.add(PM.models.Party.unserialize(party_data));
    });
    PM.domain.PartyNodeDomain.on("minus-active-party", function (party_id) {
        activeParties.remove(activeParties.get(party_id));
    });
    PM.domain.PartyNodeDomain.on("new-active-party-action", function (action_data) {
        var party = activeParties.get(action_data.party_id);
        if (party) {
            var action = PM.models.Action.unserializeFromTrusted(action_data, party);
            action.applyValidatedAction();
        }
    });


    var createAndRenderView = function (Viewclass, element, options) {
        var myoptions = _.extend(options || {}, {el: element});
        var view = new Viewclass(myoptions);
        view.render();
        var el = $(element);
        el.addClass(view.className);
        el.prop("view", view);
        el.trigger("pagecreate");
    };

    OldPartyView = Backbone.View.extend({
        template: getTemplate('old-party-page'),
        className: 'old-party-page',

        render: function () {
            var that = this;
            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            var doRender = function () {
                that.$el.html(that.template({party: that.party}));
                that.$el.trigger("pagecreate");
            };
            PM.domain.PartyNodeDomain.getMyParty(that.options.party_id, function (party_data) {
                if (!party_data) {
                    throw "Party with id " + that.options.party_id + " could not be found";
                }
                var party = PM.models.Party.unserialize(party_data);
                that.party = party;
                doRender();
            });
            return that;
        },
    });

    var ActivePartyUtil = Toolbox.Base.extend({
    }, {
        party_id: null,
        counter: 0,
        currentpopup: null,
        currentview: null,

        init: function () {
            var That = this;
            activeParties.on("add remove reset", function () {
                var current_party_active = !! activeParties.get(That.party_id);
                if (!That.party_id || current_party_active) {
                    if (That.currentpopup) {
                        That.currentpopup.popup("close");
                        //reregister as logged in
                        PM.domain.PartyNodeDomain.activateParty(That.party_id);
                    }
                } else {
                    if (!That.currentpopup) {
                        That.currentpopup = $(getTemplate("party-inactive-message")()).popup().popup("open");
                        That.currentpopup.one("popupafteropen", function () {
                            $('.ui-popup-screen.in').on("click", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                            $('.ui-popup-screen.in').on("touchstart", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                        });
                        That.currentpopup.one("popupafterclose", function () {
                            That.currentpopup = null;
                            console.log("detacked");
                        });
                        That.currentpopup.trigger("create");
                    }
                }
            });
        },

        deactivate: function () {
            var That = this;
            if (That.counter < 1) {
                throw "Trying to deactivate party, will result in negative party activations";
            }
            That.counter--;
            if (That.counter === 0) {
                PM.domain.PartyNodeDomain.activateParty(0);
                That.party_id = null;
            }
        },

        activate: function (party_id) {
            var That = this;
            if (That.party_id !== party_id) {
                //we started a new party. Any old party will be auto-removed
                That.party_id = party_id;
                That.counter = 0;
                PM.domain.PartyNodeDomain.activateParty(party_id);
            }
            That.counter++;
        },
    });

    ActivePartyUtil.init();

    PartyView = Backbone.View.extend({
        template: getTemplate('party-page'),
        className: 'party-page',

        events: {
            "click ul.tracks > li.track_in_playlist": "showControls",
            "click .delete-button": "toggleDeleteTrack",
            "click .play-button": "playTrack",
            "click .pause-button": "togglePausePlay",
        },

        close: function () {
            var that = this;
            ActivePartyUtil.deactivate();
            that.party.off("playcommand", that.onPlayCommand, that);
            that.party.get("playlist").off(null, null, that);
            that.party.off(null, null, that);
        },

        render: function () {
            var that = this;
            clutils.checkConstraints(that.options.party_id, {_isUniqueId: true});
            that.party = activeParties.get(that.options.party_id);
            if (!that.party) {
                console.log("no party found with id " + that.options.party_id);
                $.mobile.changePage("#partyoverview");
                return;
            }

            ActivePartyUtil.activate(that.party.id);
            that.$el.html(that.template({party: that.party}));
            that.party.get("playlist").on("add", that.addPlaylistItem, that);
            that.party.get("playlist").on("change:deleted_by_user_id", that.onChangePlaylistItem, that);
            that.party.get("playlist").on("reset", that.onResetPlaylist, that);
            that.party.on("change", that.onPlayStatusChange, that); // not all changed will be play status changes, but most will, so we'll just catch all...
            that.onResetPlaylist();
            _.delay(function () {
                //make popup modal
                that.$('#party-not-active-message-screen').click(function (event) {event.stopImmediatePropagation(); });
            }, 1);
            return that;
        },

        togglePausePlay: _.debounce(function () {
            var that = this;
            var type = that.party.get("play_status") === "play" ? "Pause" : "Play";
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, type, {});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        playTrack: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var track_in_playlist = $($target.parents("li.track_in_playlist")).prop("track_in_playlist");
            var index = that.party.get("playlist").indexOf(track_in_playlist);
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, "PlayTrack", {position: index});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        toggleDeleteTrack: _.debounce(function (event) {
            var that = this;
            var $target = $(event.currentTarget);
            var track_in_playlist = $($target.parents("li.track_in_playlist")).prop("track_in_playlist");
            var index = that.party.get("playlist").indexOf(track_in_playlist);
            var type = track_in_playlist.isDeleted() ? "TrackUnRemove" : "TrackRemove";
            var action = PM.models.Action.createAction(PM.app.loggedin_user, that.party, type, {position: index});
            PM.domain.PartyNodeDomain.proposeAction(action.serialize());
        }, 400, {immediate: true}),

        showControls: _.debounce(function (event) {
            var that = this;
            var target = event && event.currentTarget;

            var track_els = that.$("ul.tracks > li.track_in_playlist");
            _.each(track_els, function (element) {
                var $el = $(element);
                if (element === target) {
                    $el.toggleClass("show-controls");
                } else {
                    $el.removeClass("show-controls");
                }
            });
            that.hideControlsAfterTimeout();
        }, 200, {immediate: true}),

        hideControlsAfterTimeout: _.debounce(function () {
            var that = this;
            that.showControls();
        }, 10000),

        onPlayStatusChange: function () {
            var that = this;
            var current_index = that.party.get("current_playlist_index");
            var track_els = that.$("ul.tracks > li.track_in_playlist");
            _.each(track_els, function (element, index) {
                var $el = $(element);
                $el.toggleClass("now-playing", index === current_index);
            });
            that.$("ul.tracks").toggleClass("paused", that.party.get("play_status") === "pause");
        },

        getTrackInPlaylistElement: function (track_in_playlist) {
            var track = track_in_playlist.getTrack();
            var user = track_in_playlist.getUser();
            var deleted_by_user = track_in_playlist.getDeletedByUser();
            var el = $(getTemplate("playlist-item")({track: track, track_in_playlist: track_in_playlist, user: user, deleted_by_user: deleted_by_user}));
            el.prop({track_in_playlist: track_in_playlist});
            return el;
        },

        updateTrackInPlaylistElement: function (element) {
            var $element = $(element);
            var track_in_playlist = $element.prop("track_in_playlist");
            $element.toggleClass("deleted", track_in_playlist.isDeleted());
            $(".deleted-by", $element).html(track_in_playlist.isDeleted() ? track_in_playlist.getDeletedByUser().getHtmlLazyLoad("name") : "");
        },

        addPlaylistItem: function (track_in_playlist) {
            var that = this;
            var tracks_dom = that.$("ul.tracks");
            var track_el = that.getTrackInPlaylistElement(track_in_playlist);
            that.updateTrackInPlaylistElement(track_el);
            tracks_dom.append(track_el);
            that.$('ul.tracks.ui-listview').listview('refresh');
        },

        onChangePlaylistItem: function (track_in_playlist) {
            var that = this;
            var track_els = that.$("ul.tracks > li.track_in_playlist");
            _.each(track_els, function (el) {
                if ($(el).prop("track_in_playlist") === track_in_playlist) {
                    that.updateTrackInPlaylistElement(el);
                }
            });
        },

        onResetPlaylist: function () {
            var that = this;
            var tracks_in_playlist = that.party.get("playlist").toArray();
            var track_els = that.$("ul.tracks > li.track_in_playlist");
            var i;
            for (i = 0; i < tracks_in_playlist.length; i++) {
                while (track_els[i] && track_els[i].track_in_playlist !== tracks_in_playlist[i]) {
                    that.$(track_els).remove();
                    track_els.splice(i, 1);
                }
                if (!track_els[i]) {
                    break;
                }
                that.updateTrackInPlaylistElement(that.$(track_els[i]));
            }
            for (; i < tracks_in_playlist.length; i++) {
                that.addPlaylistItem(tracks_in_playlist[i]);
            }
            that.onPlayStatusChange();
        },

        
    });

    PartyOverviewView = Backbone.View.extend({
        template: getTemplate('party-overview-page'),
        className: 'party-overview-page',

        close: function () {
            var that = this;
            activeParties.off(null, null, that);
        },

        render: function () {
            var that = this;
            that.$el.html(that.template());
            activeParties.on("add", that.addActiveParty, that);
            activeParties.on("remove", that.removeActiveParty, that);
            activeParties.on("reset", that.resetActiveParties, that);
            activeParties.on("change", that.activePartyChange, that);
            that.resetActiveParties();
            that.loadAndRenderAllParties();
            return that;
        },

        activePartyChange: function (party) {
            var that = this;
            var el = that.$('ul.parties li.active-party.party_' + party.id);
            var new_el = $(getTemplate("active-party-in-list")({party: party}));
            $("h2", el).html($("h2", new_el).html());
            $("a > span", el).html($("a > span", new_el).html());
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        resetActiveParties: function () {
            var that = this;
            that.$('ul.parties li.active-party.party').remove();
            activeParties.each(_.bind(that.addActiveParty, that));
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
        },

        removeActiveParty: function (party) {
            var that = this;
            that.$('ul.parties li.active-party.party_' + party.id).addClass("invisible");
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
        },

        addActiveParty: function (party) {
            var that = this;
            var li = $(getTemplate("active-party-in-list")({party: party}));
            li.addClass("invisible party_" + party.id);
            _.delay(function () {li.removeClass("invisible"); }, 0);
            that.$('#all-parties-divider').before(li);
            that.$('ul.parties').toggleClass("has-active-parties", activeParties.length > 0);
            that.$('ul.parties.ui-listview').listview('refresh');
        },

        loadAndRenderAllParties: function (callback) {
            var that = this;
            PM.domain.PartyNodeDomain.getMyParties(/*limit*/ 50, /*before_timestamp*/ null, function (parties_data, parties_left) {
                var parties = _.map(parties_data, function (party_data) {return PM.models.Party.unserialize(party_data); });
                var template = getTemplate("all-parties-list");
                var html = template({parties: parties, parties_left: parties_left});
                that.$('#all-parties-divider').after(html);
                that.$('ul.parties.ui-listview').listview('refresh');
                if (callback) {
                    callback();
                }
            });
        },
    });

    LoginView = Backbone.View.extend({
        template: getTemplate('login-page'),

        events: {
            "click .fb-login-button": "facebookLogin",
        },

        className: 'login-page',

        render: function () {
            var that = this;
            that.$el.html(that.template({party_id: that.options.party_id}));
            return that;
        },

        facebookLogin: function () {
            window.location = "https://m.facebook.com/dialog/oauth?redirect_uri=" + encodeURIComponent(window.location.toString()) + "&client_id=" + encodeURIComponent(PM.domain.FacebookDomain.FACEBOOK_APP_ID) + "&response_type=token";
        },
    });

    window.onerror = function () {
        _.delay(function () {
            var popup = $(getTemplate("error-message")()).popup().popup("open");
            popup.one("popupafteropen", function () {
                $('.ui-popup-screen.in').on("click", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
                $('.ui-popup-screen.in').on("touchstart", function (event) {event.stopImmediatePropagation(); }); // removes overlay click-to-close
            });
            popup.trigger("create");
        });
    };

    var router = new $.mobile.Router({
        "^#login(?:\\?(.*))?$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                console.log("login");
                var params = (match[1] && match[1].length) ? router.getParams(match[1]) : {};
                PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                    if (loggedin) {
                        if (params.party_id) {
                            $.mobile.changePage("#party/" + params.party_id);
                        } else {
                            $.mobile.changePage("#partyoverview");
                        }
                    } else {
                        createAndRenderView(LoginView, page, {party_id: params.party_id});
                    }
                });
            },
        },
        "^#partyoverview": {
            events: "bs",
            handler: function (type, match, ui, page) {
                createAndRenderViewLoggedin(PartyOverviewView, page);
            },
        },
        "^#activeparty_([A-Za-z0-9_\\-]*)": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(PartyView, page, {party_id: party_id});
            },
        },
        "^#oldparty_([A-Za-z0-9_\\-]*)": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var party_id = match[1];
                createAndRenderViewLoggedin(OldPartyView, page, {party_id: party_id});
            },
        },
        ".": {
            events: "h",
            handler: function (type, match, ui, page) {
                var view = $(page).prop("view");
                if (view && view.close) {
                    view.close();
                }
            },
        },
        "^#([^?]*)": {
            events: "bC",
            handler: function (undefined, match) {
                var page_id = match[1];
                if (!document.getElementById(page_id)) {
                    var page = $("<div>");
                    page.attr({
                        id: page_id,
                        "data-role": "page",
                    });
                    page.text(page_id);
                    $('body').append(page);
                }
            }
        },
    });

    PM.domain.FacebookDomain = PM.domain.FacebookWebDomain;
    PM.domain.FacebookDomain.init();
    PM.domain.SpotifyDomain = PM.domain.SpotifyWebDomain;

})(window.PM);
