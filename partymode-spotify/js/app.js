/*jslint browser:true, vars: true, nomen: true */

if (!window.PM) {
    window.PM = {};
}
var clutils = window.clutils;

(function (PM, Backbone, $, _) {
    "use strict";
    var FacebookLoginView, PartiesOverviewView, PartyView, InviteUsersView, AddTrackView, OldPartiesView;

    var getTemplate = function (id) {
        var template = PM.templates[id];
        if (!_.isFunction(template)) {
            throw "Template '" + id + "' not found";
        }
        return template;
    };

    var current_view = null;
    var changeView = function (new_view) {
        if (current_view) {
            if (current_view.close) {
                current_view.close();
            }
            current_view.undelegateEvents();
        }
        current_view = new_view;
        current_view.render($('#main-content'));
    };

    var checkFacebookLogin = function (loggedincode) {
        if (PM.app.loggedin_user) {
            loggedincode();
        } else {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.domain.FacebookDomain.getLoggedinUserId(function (user_id) {
                        PM.app.loggedin_user = PM.models.User.getById(user_id);
                        PM.app.loggedin_user.onLoaded(function () {
                            PM.domain.FacebookDomain.getAccessToken(function (accessToken) {
                                PM.domain.PartyNodeDomain.connect(accessToken, true);
                                PM.domain.FacebookDomain.on("new token", function (token) {
                                    PM.domain.PartyNodeDomain.updateToken(token);
                                });
                                checkFacebookLogin(loggedincode);
                            });
                        });
                    });
                } else {
                    PM.app.navigate("", {trigger: true});
                }
            });
        }
    };

    var shareAction = function (action) {
        PM.domain.PartyNodeDomain.shareAction(action.serialize());
    };

    var my_active_party = null;

    var handleNewPartyAction = function (action_data, callback) {
        if (my_active_party && action_data.party_id === my_active_party.id) {
            var action = PM.models.Action.unserializeFromTrusted(action_data, my_active_party);
            action.validateAndApplyAction(function () {
                callback(true);
            }, function () {
                callback(false);
            });
        }
    };

    var getAndActivateParty = function (party_id, callback) {
        PM.domain.PartyNodeDomain.activateParty(party_id, function (party) {
            if (!party) {
                throw "Party not found";
            }
            party.get("log").on("add", shareAction);
            my_active_party = party;
            PM.domain.PartyNodeDomain.on("new-active-party-action", handleNewPartyAction);
            PM.domain.SpotifyAppIntegrator.startParty(party);
            callback(party);
        });
    };

    var deactivateParty = function (party) {
        party.get("log").off("add", shareAction);
        PM.domain.PartyNodeDomain.off("new-active-party-action", handleNewPartyAction);
        my_active_party = null;
        PM.domain.SpotifyAppIntegrator.stopParty(party);
        PM.domain.PartyNodeDomain.activateParty(null);
    };


    FacebookLoginView = Backbone.View.extend({
        className: "welcome-page",

        events: {
            "click .facebook-login button": "login",
        },

        template: getTemplate("welcome-page"),

        render: function (target) {
            var that = this;
            that.$el.html(that.template());
            target.html(that.$el);
            return that;
        },

        login: function () {
            PM.domain.FacebookDomain.showLoginPopup(function () {
                PM.app.navigate("");
                PM.app.facebookLogin(); // will advance to the new party page if logged in
            });
        },
    });

    PartiesOverviewView = Backbone.View.extend({
        className: "parties-overview-page",

        events: {
            "click #logout": "logout",
            "submit #new-party-form": "createNewParty",
            "click .continue-party": "continueParty",
            "click .add-as-playlist": "addAsPlaylist",
            "click .playlist-see-all": "playlistSeeAll",
        },

        template: getTemplate("parties-overview-page"),

        close: function () {
            $(window).off("scroll:parties_overview_page");
        },

        render: function (target) {
            var that = this;
            that.$el.html(that.template({default_party_name: PM.models.Party.getDefaultPartyName(PM.app.loggedin_user)}));
            target.html(that.$el);
            that.$("#new-party-name").focus();
            $(window).on("scroll:parties_overview_page", _.bind(that.checkToLoadContent, that));
            _.delay(_.bind(that.checkToLoadContent, that), 0);
            return that;
        },

        logout: function () {
            PM.domain.FacebookDomain.logout();
            PM.app.navigate("", {trigger: true});
        },

        createNewParty: _.debounce(function () {
            var party_name = $('#new-party-form #new-party-name').val().trim();
            if (party_name === "") {
                party_name = PM.models.Party.getDefaultPartyName(PM.app.loggedin_user);
            }
            var party_id = clutils.getUniqueId();
            var party = new PM.models.Party({
                _id: party_id,
            });

            party.get("log").on("add", shareAction);

            party.createAndApplyMasterAction(
                "Initialize",
                {owner_id: PM.app.loggedin_user.id},
                function () {
                    party.createAndApplyMasterAction(
                        "ChangeName",
                        {name: party_name},
                        function () {
                            party.createAndApplyMasterAction(
                                "Invite",
                                {invited_user_id: PM.app.loggedin_user.id},
                                function () {
                                    party.get("log").off("add", shareAction);
                                    PM.app.navigate("party/" + party.id, {trigger: true});
                                }
                            );
                        }
                    );
                }
            );
        }, 10000, /*immediate*/ true), // kill double clicks within 10 seconds

        loadAndRenderMoreParties: function () {
            var that = this;
            var template = getTemplate("old-party");
            var limit = 10;
            var before_timestamp = that.last_shown_party_last_updated;
            window.mytracks = [];
            PM.domain.PartyNodeDomain.getOwnParties(limit, before_timestamp, function (parties_data, parties_left) {
                _.each(parties_data, function (party_data) {
                    var party = PM.models.Party.unserialize(party_data);
                    var tracks = _.map(party.getNotDeletedTracksInPlaylist(), function (track_in_playlist) {return track_in_playlist.getTrack(); });
                    var domnode;
                    var fixcoverart = _.debounce(function () {
                        if (_.all(tracks, function (track) {return track.get("_status") !== PM.models.Track.LOADING; })) {
                            var seen = {};
                            var target = $(".art", domnode);
                            target.empty();
                            _.each(tracks, function (track) {
                                var albumcover = track.get("albumcover");
                                if (_.keys(seen).length < 4 && albumcover && !seen[albumcover]) {
                                    seen[albumcover] = true;
                                    var img = $('<img>');
                                    img.attr("src", albumcover);
                                    target.append(img);
                                }
                                target.parent().removeClass("loading");
                            });
                        }

                    }, 50);
                    _.each(tracks, function (track) {track.onLoaded(fixcoverart); });
                    domnode = $(template({party: party, }));
                    domnode[0].party = party;
                    var playlist_node = PM.domain.SpotifyAppIntegrator.getPlaylistDomForOldPartyPage(party);
                    $(".playlist-placeholder", domnode).empty().append(playlist_node);
                    that.$('#parties').append(domnode);
                    that.last_shown_party_last_updated = party.get("last_updated");
                });
                that.$("#parties").removeClass("loading");
                if (parties_left === 0) {
                    that.no_more_to_load = true;
                }
            });
        },

        checkToLoadContent: _.debounce(function () {
            var that = this;
            if (!that.no_more_to_load && !that.$("#parties").hasClass("loading") && $(window).scrollTop() >= $(document).height() - $(window).height() - 100) {
                that.$("#parties").addClass("loading");
                that.loadAndRenderMoreParties();
            }
        }, 50),

        continueParty: function (event) {
            var party = $(event.currentTarget).parents(".party")[0].party;
            PM.app.navigate("party/" + party.id, {trigger: true});
        },

        addAsPlaylist: function (event) {
            var party = $(event.currentTarget).parents(".party")[0].party;
            PM.domain.SpotifyAppIntegrator.addPartyAsPlaylist(party);
        },

        playlistSeeAll: function (event) {
            var party = $(event.currentTarget).parents(".party")[0].party;
            $(event.currentTarget).prevAll(".playlist-placeholder").css("max-height", (20 * party.getNotDeletedTracksInPlaylist().length) + "px");
            $(event.currentTarget).css("visibility", "hidden");
        },
    });

    InviteUsersView = Backbone.View.extend({
        className: "invite-users-overlay",

        template: getTemplate("invite-users-overlay"),

        events: {
            "search #users-search-box": "updateFilter",
            "click #users-search-box": function (event) {event.target.select(); },
            "click #users-search-invite": "invite",
            "mousedown #users-search-results .users li": "userSelectClick",
        },

        initialize: function (options) {
            var that = this;
            that.parent = options.parent;
        },

        closeMe: function () {
            var that = this;
            that.parent.closeOverlayView();
        },

        close: function () {
            var that = this;
            that.allFriends.off();
            that.usersToInvite.off();
            that.usersToKick.off();
        },

        render: function (target) {
            var that = this;
            that.$el.html(that.template());
            target.html(that.$el);
            
            that.userDoms = {};
            that.allFriends = new PM.collections.Users();
            that.allFriends.on("change", that.updateUsers, that);
            that.usersToInvite = new PM.collections.Users();
            that.usersToInvite.on("add", that.updateUsers, that);
            that.usersToInvite.on("remove", that.updateUsers, that);
            that.usersToInvite.on("add", that.updateUsers, that);
            that.usersToInvite.on("remove", that.updateUsers, that);
            that.usersToKick = new PM.collections.Users();
            that.usersToKick.on("add", that.updateUsers, that);
            that.usersToKick.on("remove", that.updateUsers, that);
            that.filterText = "";
            
            PM.models.User.getAllFriendsOfLoggedinUser(function (users) {
                that.allFriends.add(users);
                that.updateUsers();
                that.$('#users-search-results').removeClass("loading");
                that.$('#users-search-box')[0].focus();
            });
            return that;
        },

        userSelectClick: function (event) {
            var that = this;
            var user = event.currentTarget.user;
            if (that.parent.party.isMember(user.id)) {
                that.usersToInvite.remove(user);
                if (that.usersToKick.get(user.id)) {
                    that.usersToKick.remove(user);
                } else {
                    that.usersToKick.add(user);
                }
            } else {
                // not currently member
                that.usersToKick.remove(user);
                if (that.usersToInvite.get(user.id)) {
                    that.usersToInvite.remove(user);
                } else {
                    that.usersToInvite.add(user);
                }
            }
        },

        updateUsers: function () {
            var that = this;
            that.allFriends.each(function (user) {
                that.getUserDom(user);
            });
            var index = 0;
            _.each(that.$('.users').children(), function (child) {
                if (!$(child).hasClass("filtered")) {
                    $(child).toggleClass("even", index % 4 < 2);
                    index++;
                }
            });
        },

        getUserDom: function (user) {
            var that = this;
            if (!that.userDoms[user.id]) {
                that.userDoms[user.id] = $(getTemplate("invite-user")());
                that.userDoms[user.id][0].user = user;
                that.$('.users').append(that.userDoms[user.id]);
            }
            var userDom = that.userDoms[user.id];
            userDom.toggleClass("on-off-slider-on",
                                !!((that.parent.party.isMember(user.id) && !that.usersToKick.get(user.id)) ||
                                   that.usersToInvite.get(user.id)));
            var name = user.get('name');
            //TODO: create a better search algorithm
            userDom.toggleClass("filtered", name.toLowerCase().indexOf(that.filterText) !== 0);
            $("img.icon", userDom).attr("src", user.getProfilePictureUrl());
            $(".name", userDom).text(name);

        },

        updateFilter: function () {
            var that = this;
            that.filterText = that.$('#users-search-box').val().toLowerCase().trim();
            that.updateUsers();
        },

        invite: function () {
            var that = this;
            that.$('#users-search-invite').attr("disabled", "disabled");
            var torun;
            that.usersToInvite.off(); //avoid redraws
            that.usersToKick.off();
            torun = function (callback) {
                var user = that.usersToInvite.pop();
                if (user) {
                    that.parent.party.createAndApplyMasterAction(
                        "Invite",
                        {invited_user_id: user.id},
                        function () {torun(callback); },
                        function () {torun(callback); }
                    );
                    //TODO: send actual invite (facebook message, email, etc) if we should
                } else {
                    user = that.usersToKick.pop();
                    if (user) {
                        that.parent.party.createAndApplyMasterAction(
                            "Kick",
                            {kicked_user_id: user.id},
                            function () {torun(callback); },
                            function () {torun(callback); }
                        );
                    } else {
                        if (callback) {
                            callback();
                        }
                    }
                }
            };
            torun(function () {
                window.party = that.parent.party;
                that.closeMe();
            });

        },

    });

    AddTrackView = Backbone.View.extend({
        className: "add-track-overlay",

        template: getTemplate("add-track-overlay"),

        events: {
            "search #track-search-box": "searchTrack",
            "click #track-search-box": function (event) {event.target.select(); },
            "click #track-search-results .tracks li": "trackSelected",
        },

        initialize: function (options) {
            var that = this;
            that.parent = options.parent;
        },

        closeMe: function () {
            var that = this;
            that.parent.closeOverlayView();
        },

        render: function (target) {
            var that = this;
            that.$el.html(that.template());
            target.html(that.$el);
            that.$('#track-search-box')[0].focus();
            
            return that;
        },

        searchTrack: _.debounce(function (event) {
            var that = this;
            var searchtext = $(event.target).val();
            if (searchtext === "") {
                that.$('#track-search-results').removeClass("loading");
                that.$('#track-search-results .tracks').html("");
                return;
            }
            that.$('#track-search-results').addClass("loading");
            PM.domain.SpotifyDomain.search(searchtext, function (tracks_data) {
                var tracks = _.map(tracks_data, function (track_data) {
                    return PM.models.Track.getBySpotifyData(track_data);
                });
                if (searchtext !== $(event.target).val()) {
                    // search text changed, not showing old results
                    // NOTE: this may in theory result in not showing anything, but that is only in some strange race condition
                    return;
                }
                that.$('#track-search-results').removeClass("loading");
                that.$('#track-search-results .tracks').html(getTemplate("tracks-search-results")({tracks: tracks}));
                _.each(that.$('#track-search-results .tracks li'), function (el, index) {
                    el.track = tracks[index]; // not very nice way to assign but hey, it works :)
                });
            });
        }, 50),
        
        trackSelected: function (event) {
            var that = this;
            var track = event.currentTarget.track;
            that.parent.party.createAndApplyMasterAction("TrackAdd", {track_id: track.id}, function () {that.closeMe(); });
        },
    });

    PartyView = Backbone.View.extend({
        className: "party-page",

        template: getTemplate("party-page"),

        events: {
            "click #add-track": "addTrack",
            "click #invite-users": "inviteUsers",
            "click #overlay-backdrop": "closeOverlayView",
            "click #users-bar li .kick": "kickUser",
            "click #users-bar .arrow-left": function () {this.scrollUserBar("-"); },
            "click #users-bar .arrow-right": function () {this.scrollUserBar("+"); },
            "keyup": function (event) {if (event.keyCode === 27) {this.closeOverlayView(); }},
            "click #playlist-placeholder .delete-button": "toggleDeleteTrack",
        },

        initialize: function (attributes) {
            var that = this;
            that.overlayView = null;
            that.currentUserbarScrollPosition = 0;
            that.party_id = attributes.id;

        },

        close: function () {
            var that = this;
            that.closeOverlayView();
            that.party.get("users").off("add", that.updateUserBar, that);
            that.party.get("users").off("remove", that.updateUserBar, that);
            that.party.get("users").off("reset", that.updateUserBar, that);
            that.party.off("change:current_playlist_index", that.setCoverPhoto, that);
            that.$('img.coverphoto').off("load.photopage");
            $(window).off("resize.photopage");
            deactivateParty(that.party);
        },

        addOverlayView: function (overlayView) {
            var that = this;
            that.closeOverlayView();
            that.overlayView = overlayView;
            that.overlayView.render(that.$('#overlay-placeholder'));
            that.$('#overlay-backdrop').addClass("active");
        },

        closeOverlayView: function () {
            var that = this;
            if (that.overlayView) {
                if (that.overlayView.close) {
                    that.overlayView.close();
                }
                that.overlayView.undelegateEvents();
            }
            that.$('#overlay-backdrop').removeClass("active");
            that.$('#overlay-placeholder').html("");
        },

        resizeCoverPhoto: function () {
            var that = this;
            var width = that.$('.coverphoto-container').width();
            var height = Math.floor(314 / 850 * width); // these are the dimensions of a fb cover photo
            //now reposition image;
            var image = that.$('img.coverphoto');
            var imgheight = image.height();
            if (imgheight > 0) {
                var offset = image.attr("offset_y");
                var heightdiff = imgheight - height;
                if (heightdiff < 0) {
                    heightdiff = 0;
                    that.$('.coverphoto-container').height(imgheight);
                } else {
                    that.$('.coverphoto-container').height(height);
                }
                var top = Math.round(heightdiff * offset * 0.01);
                image.css({top: "-" + top + "px"});
            }
        },

        setCoverPhoto: function () {
            var that = this;
            var user;
            if (that.party.get("current_playlist_index") === -1) {
                user = that.party.getOwner();
            } else {
                var user_id = that.party.get("playlist").at(that.party.get("current_playlist_index")).get("user_id");
                if (user_id === "master") {
                    user = that.party.getOwner();
                } else {
                    user = PM.models.User.getById(user_id);
                }
            }
            that.$('.coverphoto-container')[0].user = user;
            user.onLoaded(function () {
                if (that.$('.coverphoto-container')[0].user === user) { //else while loading this user, we were ordered to show another user
                    if (user.get("cover_url")) {
                        that.$('img.coverphoto').attr({
                            offset_y: user.get("cover_offset_y"),
                            src: user.get("cover_url"),
                        });
                        that.$('.coverphoto-container').removeClass("no-cover-photo");
                    } else {
                        that.$('.coverphoto-container').addClass("no-cover-photo");
                    }
                    if (that.party.get("current_playlist_index") !== -1) {
                        var user_id = that.party.get("playlist").at(that.party.get("current_playlist_index")).get("user_id");
                        that.$('.coverphoto-container .currentsong > .requested-by').text(PM.models.User.getById(user_id).get("name")); //note: don't use "user" here because if master user, we want the name for the master user; master user will be loaded always so no need to wait...
                    }
                }
            });
            
            if (that.party.get("current_playlist_index") === -1) {
                that.$('.coverphoto-container').addClass("no-song-playing");
            } else {
                that.$('.coverphoto-container').removeClass("no-song-playing");

                var track = PM.models.Track.getById(that.party.get("playlist").at(that.party.get("current_playlist_index")).get("track_id"));
                that.$('.coverphoto-container')[0].track = track;
                track.onLoaded(function () {
                    if (that.$('.coverphoto-container')[0].track === track) {
                        that.$('.coverphoto-container .currentsong > img').attr({src: track.get("albumcover")});
                        that.$('.coverphoto-container .currentsong > .title').text(track.get("name"));
                        that.$('.coverphoto-container .currentsong > .artist').text(track.get("artist") + " - " + track.get("album"));
                    }
                });
            }
        },

        render: function (target) {
            var that = this;
            getAndActivateParty(that.party_id, function (party) {
                that.party = party;
                that.$el.html(that.template());
                target.html(that.$el);
                if (that.party.shouldShowInviteFriendsOnOpen()) {
                    that.inviteUsers();
                }
                that.updateUserBar();
                that.party.get("users").on("add", that.updateUserBar, that);
                that.party.get("users").on("remove", that.updateUserBar, that);
                that.party.get("users").on("reset", that.updateUserBar, that);
                that.party.on("change:current_playlist_index", that.setCoverPhoto, that);
                that.$('img.coverphoto').on("load.photopage", _.bind(that.resizeCoverPhoto, that));
                $(window).on("resize.photopage", _.bind(that.resizeCoverPhoto, that));
                $(window).on("resize.photopage", _.bind(that.updateUserBar, that));//needed to add/remove userbar arrows
                var playlistNode = PM.domain.SpotifyAppIntegrator.getHtmlNodeForActivePlaylist(that.party);
                if (that.party.get("current_playlist_index") !== -1) {
                    that.party.trigger("playcommand", "play", that.party.get("current_playlist_index"));
                }
                that.$('#playlist-placeholder').html(playlistNode);
                that.setCoverPhoto();
            });
            return that;
        },

        toggleDeleteTrack: _.debounce(function (event) { //debouce to prevent double-click
            var that = this;
            var index = $(event.currentTarget.parentNode.parentNode).prevAll().length;
            if (that.party.get("playlist").at(index).isDeleted()) {
                that.party.createAndApplyMasterAction("TrackUnRemove", {position: index, });
            } else {
                that.party.createAndApplyMasterAction("TrackRemove", {position: index, });
            }
        }, 200, {immediate: true}),

        updateUserBar: _.debounce(function () {
            var that = this;
            var elementsmap = {};
            _.each(that.$('#users-bar > ul > li'), function (el) {
                elementsmap[el.user.id] = $(el);
            });
            var users_in_party = that.party.getMembersInPartyOrderedByActive();
            _.each(users_in_party, function (user_in_party) {
                var user = PM.models.User.getById(user_in_party.get("user_id"));
                var el = elementsmap[user.id];
                delete elementsmap[user.id];
                if (!el) {
                    el = $('<li><img class="icon"><div class="kick hoverdata"></div><div class="name loading hoverdata"></li>');
                    el[0].user = user;
                    that.$('#users-bar > ul').append(el);
                }
                el.find("img.icon").attr("src", user.getProfilePictureUrl());
                var nameel = el.find(".name");
                user.onLoaded(function () {
                    nameel.removeClass("loading");
                    nameel.text(user.get("name"));
                });
                el.toggleClass("owner", that.party.isOwner(user.id));
                el.toggleClass("joined", user_in_party.isJoined());
                if (user_in_party.get("ts_last_action") !== el[0].last_ts_last_action) {
                    el[0].last_ts_last_action = user_in_party.get("ts_last_action");
                    el.addClass("new");
                    _.delay(function () {el.removeClass("new"); }, 1);
                }
            });
            for (var id in elementsmap) {
                if (elementsmap.hasOwnProperty(id)) {
                    elementsmap[id].remove();
                }
            }
            that.scrollUserBar();

            var maxUsersDisplayed = Math.floor(that.$('#users-bar > ul').width() / that.$('#users-bar > ul > li').width());
            $('#users-bar').toggleClass("need-arrows", users_in_party.length > maxUsersDisplayed);
        }, 10),

        scrollUserBarBounceBack: _.debounce(function (amount) {
            var that = this;
            that.scrollUserBar(amount);
        }, 200),

        scrollUserBarResetTimer: _.debounce(function () {
            var that = this;
            if (that.$('#users-bar:hover').length) {
                //mouse over, not resetting
                that.scrollUserBarResetTimer();
            } else {
                that.scrollUserBar(0);
            }
        }, 5000),

        scrollUserBar: function (amount) {
            var that = this;
            if (!that.scrollUserBarBounceBack) {
                that.scrollUserBarBounceBack = _.debounce(_.bind(that.scrollUserBar, that), 200);
                that.scrollUserBarResetTimer = _.debounce(_.bind(that.scrollUserBar, that, 0), 5000);
            }
            
            var newUserbarScrollPosition;
            switch (amount) {
            case "+":
                newUserbarScrollPosition = that.currentUserbarScrollPosition + 1;
                break;
            case "-":
                newUserbarScrollPosition = that.currentUserbarScrollPosition - 1;
                break;
            case undefined:
                newUserbarScrollPosition = that.currentUserbarScrollPosition;
                break;
            default:
                newUserbarScrollPosition = amount;
                break;
            }

            var elementsmap = {};
            _.each(that.$('#users-bar > ul > li'), function (el) {
                elementsmap[el.user.id] = $(el);
            });
            var users_in_party = that.party.getMembersInPartyOrderedByActive();
            _.each(users_in_party, function (user_in_party, index) {
                var user_id = user_in_party.get("user_id");
                var el = elementsmap[user_id];
                if (el) {
                    el[0].style.left = (el.width() * (index - newUserbarScrollPosition)) + "px";
                }
            });

            var maxUsersDisplayed = Math.floor(that.$('#users-bar > ul').width() / that.$('#users-bar > ul > li').width());

            if (newUserbarScrollPosition !== 0) {
                if (newUserbarScrollPosition !== that.currentUserbarScrollPosition) {
                    //bounce back if out of bounds:
                    if (newUserbarScrollPosition < 0) {
                        that.scrollUserBarBounceBack(0);
                    } else if (newUserbarScrollPosition + maxUsersDisplayed > users_in_party.length) {
                        that.scrollUserBarBounceBack(Math.max(0, users_in_party.length - maxUsersDisplayed));
                    }
                    //reset after a while
                    that.scrollUserBarResetTimer();
                } else if (newUserbarScrollPosition + maxUsersDisplayed > users_in_party.length) {
                    //if it's the result of items disappearing, scroll directly
                    that.scrollUserBar(Math.max(0, users_in_party.length - maxUsersDisplayed));
                }
            }
            that.currentUserbarScrollPosition = newUserbarScrollPosition;
        },

        kickUser: function (event) {
            var that = this;
            var user = event.currentTarget.parentNode.user;
            that.party.createAndApplyMasterAction(
                "Kick",
                {kicked_user_id: user.id}
            );
        },

        addTrack: function () {
            var that = this;
            that.addOverlayView(new AddTrackView({parent: that}));
        },

        inviteUsers: function () {
            var that = this;
            that.addOverlayView(new InviteUsersView({parent: that}));
        },

    });

    var AppRouter = Backbone.Router.extend({
        routes: {
            "": "facebookLogin",
            "history": "partyHistory",
            "party/new": "startParty",
            "party/:id": "showParty",
        },

        facebookLogin: function () {
            PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.app.navigate("party/new", {trigger: true});
                } else {
                    changeView(new FacebookLoginView());
                }
            });
        },

        startParty: function () {
            checkFacebookLogin(function () {
                var view = new PartiesOverviewView();
                changeView(view);
            });
        },

        partyHistory: function () {
            checkFacebookLogin(function () {
                var view = new OldPartiesView();
                changeView(view);
            });
        },

        showParty: function (id) {
            checkFacebookLogin(function () {
                var view = new PartyView({id: id});
                changeView(view);
            });
        },
    });

    PM.app = new AppRouter();

    $(function () {
        PM.domain.SpotifyDomain = PM.domain.SpotifySpotifyDomain;
        PM.domain.FacebookDomain = PM.domain.FacebookSpotifyDomain;
        PM.domain.FacebookDomain.init();
        Backbone.history.start();
    });
}(window.PM, window.Backbone, window.$, window._));
