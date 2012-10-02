/*jslint browser:true, vars: true, nomen: true */
"use strict";

if (!window.PM) {
    window.PM = {};
}


(function (PM, Backbone, $, _) {
    var FacebookLoginView, StartNewPartyView, PartyView, InviteUsersView, AddSongView;

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
            "click #users-search-box": function (select) {event.target.select(); },
            "click #users-search-invite": "invite",
            "click #users-search-results .users .on-off-slider": "onOffSliderClick",
            "keyup": function (event) {if (event.keyCode === 27) {this.closeMe(); }},
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

        onOffSliderClick: function (event) {
            var that = this;
            var user = $(event.currentTarget).parent()[0].user;
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

        lookForEscape: function () {
            console.log("Lookforescape");
        },

    });

    PartyView = Backbone.View.extend({
        className: "party-page",

        template: getTemplate("party-page"),

        events: {
            "click #add-song": "addSong",
            "click #invite-users": "inviteUsers",
            "click #end-party": "endParty",
            "click #overlay-backdrop": "closeOverlayView",
        },

        initialize: function (id) {
            var that = this;
            that.overlayView = null;
            that.party = PM.collections.Parties.getInstance().get(id);
            if (!that.party) {
                throw "Party with id " + id + " was not found";
            }
        },

        close: function () {
            var that = this;
            that.closeOverlayView();
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
            return that;
        },

        addSong: function () {

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
