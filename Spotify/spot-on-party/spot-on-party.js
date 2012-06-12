/*jslint browser: true, devel: true, vars: true, newcap: true */
/*global SpotOnParty:true, SOPBase, Spotify, Facebook, Party, PartyUI, $, TDFriendSelector */

/**
 * Main interaction for SpotOnParty
 **/
"use strict";

var SpotOnParty = function () {
    var init;
    var activatePane;
    var selectFacebookFriends;
    var createStartPartyBehaviour;
    var resetNewPartyForm;
    var initFacebookFriendpicker;
    /**
     * will show the party-pane, and make sure all the interaction works
     **/
    var showParty;
    /**
      * callback that a new play command has been received
      **/
    var partyCommandReceived;

    var onfacebooklogin;
    var onfacebooklogout;

    var facebook;
    var sopbase;
    var party;
    var spotify;
    var party_ui;

    var config = {
        minLengthPartyName: 6
    };

    showParty = function () {
        activatePane("#party_pane");
        party_ui = PartyUI(party, facebook, sopbase, spotify);
    };

    activatePane = function (pane) {
        $(".activepane").removeClass("activepane");
        $(pane).addClass("activepane");
    };

    onfacebooklogin = function () {
        activatePane("#start_party_pane");
        resetNewPartyForm();
        initFacebookFriendpicker();
        sopbase = SOPBase(facebook.getAccessToken());
        /// START: shortcut code
        sopbase.createParty("auto_party_name", ["501480496", "1234318345", "100001726650746"], function (response) {
            party = Party(response.id, response.owner_id, spotify.getPlaylist(), partyCommandReceived);
            $.each(response.actions, function (index, action) {
                party.feed(action);
            });
            showParty();
        });
        /// END: shortcut code
    };

    onfacebooklogout = function () {
        activatePane("#login_pane");
    };

    initFacebookFriendpicker = function () {
        selectFacebookFriends.inited = false;
        TDFriendSelector.init({debug: false});
        $.getJSON('https://graph.facebook.com/me/friends&access_token=' + window.encodeURIComponent(facebook.getAccessToken()) + '&callback=?', function (result) {
            TDFriendSelector.setFriends(result.data);
            selectFacebookFriends.inited = true;
        });
    };

    // assumes to be called only AFTER the party and the ui has been updated
    partyCommandReceived = function (command, parameters) {
        var song_id, spotify_playlist, spotify_playlist_position;
        if (parameters && parameters.position !== undefined) {
            song_id = party.getPartyInfo().song_ids[parameters.position];
            spotify_playlist = party.getSpotifyPlaylist();
            spotify_playlist_position = party.getSpotifyPlaylistPositionFromPartyInfoPosition(parameters.position);
        }
        switch (command) {
        case Party.COMMAND_PLAY_POSITION:
            spotify.play(song_id, spotify_playlist, spotify_playlist_position);
            break;
        case Party.COMMAND_PLAY_IF_STOPPED:
            if (spotify.isStoppedOrNotPlayingFromApp()) {
                spotify.play(song_id, spotify_playlist, spotify_playlist_position);
            }
            break;
        }
    };

    createStartPartyBehaviour = function () {
        $("#start_party_button").click(function (event) {
            $("#start_party_name_form").addClass("active");
            $("#start_party_name")[0].focus();
            event.preventDefault();
        });
        $("#start_party_name_form").submit(function (event) {
            var name = $("#start_party_name").val();
            if (name.length < config.minLengthPartyName) {
                $("#start_party_name_error_length").removeClass("active");
                window.setTimeout(function () {
                    $("#start_party_name_error_length").addClass("active");
                }, 1);
            } else {
                selectFacebookFriends(function (facebook_ids) {
                    sopbase.createParty(name, facebook_ids, function (response) {
                        party = Party(response.id, response.owner_id, spotify, partyCommandReceived);
                        $.each(response.actions, function (index, action) {
                            party.feed(action);
                        });
                        showParty();
                    });
                });
            }
            event.preventDefault();
        });
    };

    resetNewPartyForm = function () {
        $("#start_party_pane .active").removeClass("active");
        $("#start_party_pane .input").val("");
    };

    selectFacebookFriends = function (callback) {
        if (!selectFacebookFriends.inited) {
            window.setTimeout(function () {selectFacebookFriends(callback); }, 100); // try again in 100ms
        } else {
            var selector = TDFriendSelector.newInstance({
                maxSelection: 100,
                callbackSubmit: callback
            });
            selector.showFriendSelector();
        }

    };

    init = function () {
        createStartPartyBehaviour();
        $("#facebook_login_button").click(function (event) {
            facebook = Facebook(onfacebooklogin, onfacebooklogout);
        });
        /// START: shortcut code
        facebook = Facebook(onfacebooklogin, onfacebooklogout);
        /// END: shortcut code
        party = null;
        spotify = Spotify(function (is_playing, spotify_playlist_position) {
            if (party_ui) {
                party_ui.updatePlayerStatus(is_playing, spotify_playlist_position);
            }
        });
    };

    init();

    return {};
};