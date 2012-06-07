/*jslint browser: true, vars: true, newcap: true, bitwise:true */
/*global PartyUI:true, $ */

/**
 * Reponsible for all interaction.
 * "Update" will be called every time there is new information in "party"
 **/
"use strict";

var PartyUI = function (party, facebook, sopbase, spotify) {
    var init;
    var update;

    var updateInfo;
    var updatePlaylist;
    var getSongDom;
    var getUserDom;
    var getNewsfeedItemDom;

    var setFramesetFromRight;
    var setFramesetLeftFromTop;
    var setFramesetRightFromTop;

    var playlist;
    var joined_userlist;
    var invited_userlist;
    var newsfeed;

    updateInfo = function () {
        $("#party_info .name").text(party.getPartyInfo().name);
    };

    getSongDom = function (position, song_id) {
        var dom = $('<div></div>')
            .attr({id: "playlist_item_" + position, position: position, song_id: song_id})
            .addClass("song").addClass("loading")
            .append($('<img>').addClass("coverart"))
            .append($('<div></div>').addClass("trackname"))
            .append($('<div></div>').addClass("artistname"))
            .append($('<a>remove</a>').addClass("btn_remove"))
            .append($('<a>play</a>').addClass("btn_play"));
        spotify.getTrack(song_id, function (track) {
            var artistname;
            dom.removeClass("loading");
            dom.find("img.coverart").attr({src: track.image});
            artistname = $.map(track.artists, function (artist) {return artist.name; }).join(", ");
            dom.find("div.artistname").text(artistname);
            dom.find("div.trackname").text(track.name);
        });
        return dom;
    };

    updatePlaylist = function () {
        var playlist_dom = $("#party_playlist");
        $.each(party.getPartyInfo().song_ids, function (position, song_id) {
            var element = $("#playlist_item_" + position)[0];
            if (song_id && !element) {
                var dom = getSongDom(position, song_id);
                $("#party_playlist").append(dom);
            }
            if (!song_id && element) {
                $(element).addClass("removed");
            }
        });
    };

    setFramesetFromRight = function (width) {
        $("#party_playlist, #party_info").css("right", width + "px");
        $("#party_users, #party_newsfeed").css("width", width + "px");
    };

    setFramesetLeftFromTop = function (height) {
        $("#party_info").css("height", height + "px");
        $("#party_playlist").css("top", height + "px");
    };

    setFramesetRightFromTop = function (height) {
        $("#party_users").css("height", height + "px");
        $("#party_newsfeed").css("top", height + "px");
    };

    init = function () {
        setFramesetFromRight(300);
        setFramesetRightFromTop(400);
        setFramesetLeftFromTop(150);
        $("#party_playlist").on("click", ".btn_remove", function (event) {
            var position = $(this).parent(".song").attr("position");
            console.log("Removing from position " + position);
            sopbase.removeSong(party.getPartyInfo().id, position, function (action) {
                party.feed(action);
                update();
            });
        });

        update();
    };

    update = function () {
        updateInfo();
        updatePlaylist();
    };

    init();

    return {
        update: update
    };
};


