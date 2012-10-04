/*jslint browser:true, vars: true, nomen: true */

if (!window.PM) {
    window.PM = {};
}


(function (PM, Backbone, $, _) {
    "use strict";
    var FacebookLoginView, StartNewPartyView, PartyView, InviteUsersView, AddTrackView;

    var getTemplate = function (id) {
        var el = $('#' + id);
        if (el.length === 0) {
            throw "Template '" + id + "' not found";
        }
        return _.template(el.html());
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
        if (PM.current_user) {
            loggedincode();
        } else {
            PM.domain.FacebookSpotifyDomain.isLoggedin(function (loggedin) {
                if (loggedin) {
                    PM.app.loggedin_user_id = PM.domain.FacebookDomain.getLoggedinUserId();
                    //it would be nicer to actually use lazy loading for this user as well, but we need it directly synchronously
                    var user = new PM.models.User({
                        name: PM.domain.FacebookDomain.getLoggedinUserName(),
                        _status: PM.models.BaseModelLazyLoad.LOADED,
                        id: PM.app.loggedin_user_id,
                    });
                    PM.models.User.setToCache(user);
                    PM.current_user = PM.models.User.getMaster();
                    checkFacebookLogin(loggedincode);
                } else {
                    PM.app.navigate("", {trigger: true});
                }
            });
        }
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

    StartNewPartyView = Backbone.View.extend({
        className: "new-party-page",

        events: {
            "click #logout": "logout",
            "submit #new-party-form": "createNewParty",
        },

        template: getTemplate("new-party-page"),

        render: function (target) {
            var that = this;
            that.$el.html(that.template({default_party_name: PM.models.Party.getDefaultPartyName()}));
            target.html(that.$el);
            that.$("#new-party-name").focus();
            return that;
        },

        logout: function () {
            PM.domain.FacebookDomain.logout();
            PM.app.navigate("", {trigger: true});
        },

        createNewParty: function () {
            var party_name = $('#new-party-form #new-party-name').val().trim();
            if (party_name === "") {
                party_name = PM.models.Party.getDefaultPartyName();
            }
            var party = new PM.models.Party({
                id: 1, //TODO: we obviously need a party id that comes from the server.. Or random...
                owner: PM.current_user,
            });
            PM.collections.Parties.getInstance().add(party);

            party.createAndApplyOwnAction(
                "ChangeName",
                {name: party_name},
                function () {
                    party.createAndApplyOwnAction(
                        "Invite",
                        {invited_user_id: PM.current_user.actualUser().id},
                        function () {
                            PM.app.navigate("party/" + party.id, {trigger: true});
                        }
                    );
                }
            );
        },
    });

    InviteUsersView = Backbone.View.extend({
        className: "invite-users-overlay",

        template: getTemplate("invite-users-overlay"),

        events: {
            "search #users-search-box": "updateFilter",
            "click #users-search-box": function (event) {event.target.select(); },
            "click #users-search-invite": "invite",
            "click #users-search-results .users li": "userSelectClick",
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
                that.allFriends.add(PM.current_user.actualUser());
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
                if (that.parent.party.isOwner(user.id)) {
                    return; //Owners can't be added or removed. TODO give feedback
                }
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
                    that.parent.party.createAndApplyOwnAction(
                        "Invite",
                        {invited_user_id: user.id},
                        function () {torun(callback); },
                        function () {torun(callback); }
                    );
                } else {
                    user = that.usersToKick.pop();
                    if (user) {
                        that.parent.party.createAndApplyOwnAction(
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
            }
            that.$('#track-search-results').addClass("loading");
            PM.domain.SpotifySpotifyDomain.search(searchtext, function (tracks_data) {
                var tracks = _.map(tracks_data, function (track_data) {
                    var track = new PM.models.Track({
                        id: track_data.href,
                        _status: PM.models.BaseModelLazyLoad.LOADED,
                        name: track_data.name.decodeForText(),
                        artist: _.map(track_data.artists, function (artist) {return artist.name.decodeForText(); }).join(", "),
                        album: track_data.album.name.decodeForText(),
                    });
                    PM.models.Track.setToCache(track);
                    return track;
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
            that.parent.party.createAndApplyOwnAction("TrackAdd", {track_id: track.id}, function () {that.closeMe(); });
        },
    });

    PartyView = Backbone.View.extend({
        className: "party-page",

        template: getTemplate("party-page"),

        events: {
            "click #add-track": "addTrack",
            "click #invite-users": "inviteUsers",
            "click #end-party": "endParty",
            "click #overlay-backdrop": "closeOverlayView",
            "click #users-bar li .kick": "kickUser",
            "click #users-bar .arrow-left": function () {this.scrollUserBar("-"); },
            "click #users-bar .arrow-right": function () {this.scrollUserBar("+"); },
            "keyup": function (event) {if (event.keyCode === 27) {this.closeOverlayView(); }},
        },

        initialize: function (id) {
            var that = this;
            that.overlayView = null;
            that.party = PM.collections.Parties.getInstance().get(id);
            if (!that.party) {
                throw "Party with id " + id + " was not found";
            }
            that.currentUserbarScrollPosition = 0;
        },

        close: function () {
            var that = this;
            that.closeOverlayView();
            that.party.get("users").off("add", that.updateUserBar, that);
            that.party.get("users").off("change", that.updateUserBar, that);
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

        render: function (target) {
            var that = this;
            that.$el.html(that.template());
            target.html(that.$el);
            if (that.party.isNew()) {
                that.inviteUsers();
            }
            that.updateUserBar();
            that.party.get("users").on("add", that.updateUserBar, that);
            that.party.get("users").on("change", that.updateUserBar, that);
            return that;
        },

        updateUserBar: _.debounce(function () {
            var that = this;
            var elementsmap = {};
            _.each(that.$('#users-bar > ul > li'), function (el) {
                elementsmap[el.user.id] = $(el);
            });
            var users_in_party = that.party.getMembersInPartyOrderedByActive();
            _.each(users_in_party, function (user_in_party) {
                var user = user_in_party.get("user");
                var el = elementsmap[user.id];
                delete elementsmap[user.id];
                if (!el) {
                    el = $('<li><img class="icon"><div class="kick hoverdata"></div><div class="name hoverdata"></li>');
                    el[0].user = user;
                    that.$('#users-bar > ul').append(el);
                }
                el.find("img.icon").attr("src", user.getProfilePictureUrl());
                el.find(".name").text(user.get("name"));
                el.toggleClass("owner", that.party.isOwner(user.id));
                if (user_in_party.get("active") !== el[0].last_active) {
                    el[0].last_active = user_in_party.get("active");
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
        }, 1),

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
                var user = user_in_party.get("user");
                var el = elementsmap[user.id];
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
            that.party.createAndApplyOwnAction(
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

        endParty: function () {
            console.log("TODO implement end party");
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
                var view = new StartNewPartyView();
                changeView(view);
            });
        },

        partyHistory: function () {
            console.log("partyHistory");
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
        PM.domain.FacebookDomain = PM.domain.FacebookSpotifyDomain;
        PM.domain.FacebookDomain.init();
        Backbone.history.start();
    });
}(window.PM, window.Backbone, window.$, window._));
