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
                            console.log("done");
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
            "click #users-search-invite": "invite",
        },

        render: function (target) {
            var that = this;
            that.$el.html(that.template());
            target.html(that.$el);
            PM.domain.FacebookDomain.getAllFriends(function (friend_data) {
                
            });
            return that;
        },

        invite: function () {

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
        },

        initialize: function (id) {
            var that = this;
            that.party = PM.collections.Parties.getInstance().get(id);
            if (!that.party) {
                throw "Party with id " + id + " was not found";
            }
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