import webapp2
import model
import util
import hashlib

import urllib, urllib2, logging, json, threading, re

def to_qs(params):
    "transfers parameters to querystring format; takes special care of values that are arrays, will become csv"
    newparams = {}
    for k, v in params.items():
        if isinstance(v, (list, tuple)):
            newparams[k] = ",".join(v)
        else:
            newparams[k] = v
    return urllib.urlencode(newparams)

class RequestHandlerBase(webapp2.RequestHandler):

    def get_channel_id_from_request(self):
        SALT = "&zWJ4Er#i5 cGH-WPOkSVy!&p3qx2Mh.ZUoe["
        m = hashlib.md5()
        m.update(SALT)
        m.update(self.request.get("sid"))
        m.update(self.loggedin_user().id())
        return m.hexdigest()
        
    def get_access_token_from_request(self):
        return self.request.get("at")

    def facebook_graph_api_call(self, path, parameters, public_only_info=False):
        local_parameters = {}
        if not public_only_info:
            if self.get_access_token_from_request():
                local_parameters["access_token"] = self.get_access_token_from_request()
        local_parameters.update(parameters)

        url = "https://graph.facebook.com/%s?%s" % (path, to_qs(local_parameters))
        logging.info("making call to url %s", url)
        try:
            jsonresult = urllib2.urlopen(url).read()
            logging.debug("result from call to %s: %s", url, jsonresult)
            return json.loads(jsonresult)
        except urllib2.URLError, e:
            logging.error("Request failed: %s", e)
        except Exception, e:
            logging.error("Error in JSON: %s\n%s", e, jsonresult)


    def get_users(self, ids):
        "gets user objects, creating them for so far unknown users"
        fb_users = self.facebook_graph_api_call("", {"ids": ids, "fields": ("id","name")}, public_only_info=True).values()
        users = model.User.create_or_update_by_fb_users(fb_users)
        #TODO: deleted facebook users should be retrieved from the database.... Sometime in the future
        return users

    _access_token_to_user_cache = {}
    _access_token_to_user_cache_lock = threading.Lock()
    def loggedin_user(self):
        cls = self.__class__
        access_token = self.get_access_token_from_request()
        with cls._access_token_to_user_cache_lock: # pylint: disable=W0212
            try:
                return cls._access_token_to_user_cache[access_token] # pylint: disable=W0212
            except KeyError:
                pass #simply don't return
        fb_user = self.facebook_graph_api_call("me", {"fields": ("id", "name")})
        user = model.User.create_or_update_by_fb_users([fb_user])[0]
        with cls._access_token_to_user_cache_lock: # pylint: disable=W0212
            cls._access_token_to_user_cache[access_token] = user # pylint: disable=W0212
        return user

    def reply_jsonp(self, data):
        self.response.headers['Content-Type'] = 'application/json'
        callback_name = self.request.get("callback")
        if not re.match("^[a-zA-Z0-9_$.]+$", callback_name):
            raise Exception("Not a valid callback name")
        self.response.out.write("%s(%s);" % (
                callback_name,
                json.dumps(data, default=util.json_default_handler)))
        

class CreateParty(RequestHandlerBase):
    def get(self):
        name = self.request.get("name")
        party = model.Party.create(name, self.loggedin_user())

        self.reply_jsonp(party.for_api_use())

class RemoveSong(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        if self.request.get("sp"):
            user = model.get_party_owner_user()
        else:
            user = self.loggedin_user()
        position = long(self.request.get("position"))
        action = party.remove_song(position, user, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use()])

class PartyOn(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        action = party.activate(self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use()])

class PartyOff(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        action = party.deactivate(self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use()])

class AddSong(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        if self.request.get("sp"):
            user = model.get_party_owner_user()
        else:
            user = self.loggedin_user()
        song_id = self.request.get("song_id")
        action = party.add_song(song_id, user, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use()])

class PlayPosition(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        if self.request.get("sp"):
            user = model.get_party_owner_user()
        else:
            user = self.loggedin_user()
        position = long(self.request.get("position"))
        action = party.play_position(position, user, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use()])

class GetActions(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        last_action_id = long(self.request.get("last_action_id", 0))
        actions = party.get_actions(last_action_id, self.loggedin_user()) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use() for action in actions])

class JoinParty(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        action = party.join(self.loggedin_user()) #pylint: disable=E1103

        channel_id = self.get_channel_id_from_request()
        user_channel = model.UserChannel.get_or_init_for_user_and_channel_id(self.loggedin_user(), channel_id)
        model.PartyListener.addListener(party, user_channel)
        self.reply_jsonp([action.for_api_use()])

class LeaveParty(RequestHandlerBase):
    def get(self):
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        action = party.leave(self.loggedin_user()) #pylint: disable=E1103

        channel_id = self.get_channel_id_from_request()
        user_channel = model.UserChannel.get_or_init_for_user_and_channel_id(self.loggedin_user(), channel_id)
        model.PartyListener.removeListener(party, user_channel)
        self.reply_jsonp([action.for_api_use()])

class GetParty(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        party.loggedin_user_is_invited(loggedin_user) #pylint: disable=E1103
        self.reply_jsonp(party.for_api_use()) #pylint: disable=E1103

class GetOwnedParties(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        parties = model.Party.all().filter("owner", loggedin_user).order("-__key__")
        self.reply_jsonp([party.for_api_use() for party in parties])

class GetActiveParties(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        parties = model.Party.all().filter("active", True).filter("invited_user_ids", loggedin_user.key()).order("-__key__")
        self.reply_jsonp([party.for_api_use() for party in parties])

class GetInactiveParties(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        parties = model.Party.all().filter("active", False).filter("invited_user_ids", loggedin_user.key()).order("-__key__")
        self.reply_jsonp([party.for_api_use() for party in parties])

class GetChannelToken(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        channel_id = self.get_channel_id_from_request()
        user_channel = model.UserChannel.get_or_init_for_user_and_channel_id(loggedin_user, channel_id)
        token = user_channel.get_token()
        self.reply_jsonp({"channel_id": user_channel.get_channel_id(), "token": token})

class InviteUsers(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        invited_user_ids = self.request.get("invited_user_ids").split(",")
        invited_users = self.get_users(invited_user_ids)
        actions = party.invite_users(invited_users, loggedin_user) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use() for action in actions])

class KickUsers(RequestHandlerBase):
    def get(self):
        loggedin_user = self.loggedin_user()
        party = model.Party.get_by_id(long(self.request.get("party_id")))
        kicked_user_ids = self.request.get("kicked_user_ids").split(",")
        kicked_users = self.get_users(kicked_user_ids)
        actions = party.kick_users(kicked_users, loggedin_user) #pylint: disable=E1103
        self.reply_jsonp([action.for_api_use() for action in actions])

logging.getLogger().setLevel(logging.DEBUG)

app = webapp2.WSGIApplication([
        ('/api/1/createparty', CreateParty),
        ('/api/1/partyon', PartyOn),
        ('/api/1/partyoff', PartyOff),
        ('/api/1/inviteusers', InviteUsers),
        ('/api/1/kickusers', KickUsers),
        ('/api/1/addsong', AddSong),
        ('/api/1/removesong', RemoveSong),
        ('/api/1/playposition', PlayPosition),
        ('/api/1/getactiveparties', GetActiveParties),
        ('/api/1/getinactiveparties', GetInactiveParties),
        ('/api/1/getownedparties', GetOwnedParties),
        ('/api/1/getparty', GetParty),
        ('/api/1/getchanneltoken', GetChannelToken),
        ('/api/1/joinparty', JoinParty),
        ('/api/1/leaveparty', LeaveParty),
        ('/api/1/getactions', GetActions),
                               ], debug=True)



