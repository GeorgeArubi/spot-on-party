from google.appengine.ext import db
from google.appengine.ext.db import polymodel
from google.appengine.api import memcache
from google.appengine.api import channel
import logging, json
import util


def hooked_class(original_class): #decorator
    original_put = original_class.put
    def put(self, **kwargs):
        pre_func = getattr(self, "pre_put", None)
        if callable(pre_func):
            pre_func()
        original_put(self, **kwargs)
        post_func = getattr(self, "post_put", None)
        if callable(post_func):
            post_func()

    original_class.put = put
    return original_class

old_put = db.put

def hooked_put(models, **kwargs):
    for model in models:
        pre_func = getattr(model, "pre_put", None)
        if callable(pre_func):
            pre_func()
    old_put(models, **kwargs)
    for model in models:
        post_func = getattr(model, "post_put", None)
        if callable(post_func):
            post_func()

db.put = hooked_put


_get_party_owner_user_saved = False
def get_party_owner_user():
    user = User(key_name="party_owner", name="Party owner")
    global _get_party_owner_user_saved # pylint: disable=W0603
    if not _get_party_owner_user_saved: #threadsave: worst case it gets saved multiple times per instance
        user.put()
        _get_party_owner_user_saved = True
    return user

@hooked_class
class User(db.Model):
    "NB: the indentifier is the external id"
    name = db.StringProperty()

    def id(self):
        return self.key().id_or_name()

    @classmethod
    def create_or_update_by_fb_users(cls, fb_users):
        users = [cls(key_name=fb_user["id"], name=fb_user["name"]) for fb_user in fb_users]
        db.put(users)
        return users

@hooked_class
class Song(db.Model):
    "NB: the indentifier is the external id"
    name = db.StringProperty()

    def id(self):
        return self.key().id_or_name()


class SecurityException(Exception):
    pass

@hooked_class
class Party(db.Model):
    name = db.StringProperty()
    owner = db.ReferenceProperty(reference_class=User)
    active = db.BooleanProperty()
    invited_user_ids = db.ListProperty(db.Key)
    created = db.DateTimeProperty(auto_now_add=True)

    if False:
        party_actions = db.Query()

    @classmethod
    def create(cls, name, owner):
        party = cls()
        party.name = name
        party.owner = owner
        party.active = True
        party.invited_user_ids = []
        party.put()
        
        PartyCreateAction(parent=party, user=owner, name=name).put()
        party.invite_users([owner], owner)

        return party

    def loggedin_user_is_invited(self, loggedin_user):
        if not loggedin_user.key() in self.invited_user_ids:
            raise SecurityException("Loggedin user %s is not part of the party (%s)" % (loggedin_user.key(), ", ".join(self.invited_user_ids)))

    def loggedin_user_is_admin(self, loggedin_user):
        if loggedin_user.key() != self.owner.key():
            raise SecurityException("Loggedin user %s is not admin of the party (%s)" % (loggedin_user.key(), self.owner.key()))
        

    def invite_users(self, users, loggedin_user):
        self.loggedin_user_is_admin(loggedin_user)
        actions = []
        for user in users: 
            actions.append(PartyInviteAction(parent=self, user=loggedin_user, invited_user=user))
            self.invited_user_ids.append(user.key())
        db.put([self] + actions)
        return actions

    def kick_users(self, users, loggedin_user):
        actions = []
        for user in users: 
            if user.key() != self.owner.key(): #filter out the owner: owner can't be kicked
                actions.append(PartyKickAction(parent=self, user=loggedin_user, kicked_user=user))
                self.invited_user_ids.remove(user.key())
        db.put([self] + actions)
        return actions

    def activate(self, loggedin_user):
        self.loggedin_user_is_admin(loggedin_user)
        for other_party in Party.all().filter("owner", loggedin_user):
            if other_party.active and other_party.key().id() != self.key().id():
                other_party.deactivate(loggedin_user)
        self.active = True
        self.put()
        action = PartyOnAction(parent=self, user=loggedin_user)
        action.put()
        return action
        
    def deactivate(self, loggedin_user):
        self.loggedin_user_is_admin(loggedin_user)
        self.active = False
        self.put()
        action = PartyOffAction(parent=self, user=loggedin_user)
        action.put()
        return action

    def join(self, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        action = PartyJoinedAction(parent=self, user=loggedin_user)
        action.put()
        return action
        
    def leave(self, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        action = PartyLeftAction(parent=self, user=loggedin_user)
        action.put()
        return action
        
    def remove_song(self, position, user, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        action = PartySongRemoveAction(parent=self, user=user, position=position)
        action.put()
        return action

    def add_song(self, song_id, user, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        song = Song(key_name=song_id) #TODO: spotify lookup: does track actually exist
        song.put()
        action = PartySongAddAction(parent=self, user=user, song=song)
        action.put()
        return action

    def get_actions(self, bigger_than_action_id, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        min_nr = bigger_than_action_id + 1
        max_nr = self.get_actionid_globalcounter().current()
        memcached_keys = [PartyAction.get_memcached_key(self, nr) for nr in range(min_nr, max_nr + 1)]
        actions_dict = memcache.Client().get_multi(memcached_keys)
        if len(actions_dict) == len(memcached_keys): #all were found
            actions = [actions_dict[key] for key in memcached_keys]
        else:
            actions = PartyAction.all().ancestor(self).order("-nr").filter("nr >", bigger_than_action_id)
            to_set = {}
            for action in reversed(list(actions)):
                memcache_key = PartyAction.get_memcached_key(self, action.nr)
                if not actions_dict.has_key(memcache_key):
                    to_set[memcache_key] = action
            memcache.Client().set_multi(to_set)
        return actions

    def play_position(self, position, user, loggedin_user):
        self.loggedin_user_is_invited(loggedin_user)
        action = PartyPositionPlayAction(parent=self, user=user, position=position)
        action.put()
        return action

    def get_actionid_function(self):
        try:
            highest_action = PartyAction.all().ancestor(self).order("-nr").get()
        except db.KindError:
            return 0
        if not highest_action:
            return 0
        return highest_action.nr
        
        
    def get_actionid_globalcounter(self):
        return util.GlobalCounter("PartyAction_%d" % self.key().id(), getattr(self, "get_actionid_function"))

    def for_api_use(self):
        return {
            "type": self.__class__.__name__,
            "id": self.key().id(),
            "owner_id": self.owner.id(),
            "name": self.name,
            "active": self.active,
            "created": self.created}

@hooked_class
class PartyAction(polymodel.PolyModel):
    created = db.DateTimeProperty(auto_now_add=True)
    user = db.ReferenceProperty(reference_class=User)
    nr = db.IntegerProperty()

    @staticmethod
    def get_memcached_key(party, action_nr):
        return "PartyAction_%d_%d" % (party.key().id(), action_nr)

    def pre_put(self):
        if not self.is_saved():
            counter = self.parent().get_actionid_globalcounter()
            self.nr = counter.next()
            
    def post_put(self):
        memcache_key = PartyAction.get_memcached_key(self.parent(), self.nr)
        memcache.Client().set(memcache_key, self)

        user_channels = PartyListener.getUserChannelsForParty(self.parent())
        message = json.dumps({"type": "partyaction", "party_id": self.parent().key().id_or_name(), "action": self.for_api_use()}, default=util.json_default_handler) 
        for user_channel in user_channels:
            user_channel.send_message(message)

    def for_api_use(self):
        return {
            "type": self.__class__.__name__,
            "nr": self.nr,
            "user_id": self.user.id(),
            "created": self.created}

class PartyChangeNameAction(PartyAction):
    name = db.StringProperty()
    
    def for_api_use(self):
        return dict(super(PartyChangeNameAction, self).for_api_use().items() + [('name', self.name),])

    
class PartyCreateAction(PartyChangeNameAction):
    pass

class PartyInviteAction(PartyAction):
    invited_user = db.ReferenceProperty(reference_class=User)

    def post_put(self):
        super(PartyInviteAction, self).post_put()
        user_channels = UserChannel.get_all_for_user(self.invited_user)
        message = json.dumps({"type": "addparty", "party": self.parent().for_api_use()}, default=util.json_default_handler) 
        for user_channel in user_channels:
            user_channel.send_message(message)

    def for_api_use(self):
        return dict(super(PartyInviteAction, self).for_api_use().items() + [('invited_user_id', self.invited_user.id()),])

class PartyKickAction(PartyAction):
    kicked_user = db.ReferenceProperty(reference_class=User)
    
    def post_put(self):
        super(PartyKickAction, self).post_put()
        user_channels = UserChannel.get_all_for_user(self.kicked_user)
        message = json.dumps({"type": "removeparty", "party": self.parent().for_api_use()}, default=util.json_default_handler)
        for user_channel in user_channels:
            user_channel.send_message(message)

    def for_api_use(self):
        return dict(super(PartyKickAction, self).for_api_use().items() + [('kicked_user_id', self.kicked_user.id()),])

class PartyJoinedAction(PartyAction):
    pass

class PartyLeftAction(PartyAction):
    pass

class PartySongAddAction(PartyAction):
    song = db.ReferenceProperty(reference_class=Song)

    def for_api_use(self):
        return dict(super(PartySongAddAction, self).for_api_use().items() + [('song_id', self.song.id()),])

class PartySongRemoveAction(PartyAction):
    position = db.IntegerProperty()

    def for_api_use(self):
        return dict(super(PartySongRemoveAction, self).for_api_use().items() + [("position", self.position)])

class PartyPositionPlayAction(PartyAction):
    position = db.IntegerProperty()

    def for_api_use(self):
        return dict(super(PartyPositionPlayAction, self).for_api_use().items() +
                    [("position", self.position)])

class PartyPlayAction(PartyAction):
    pass

class PartyPauseAction(PartyAction):
    pass

class PartyOnAction(PartyAction):
    def post_put(self):
        super(PartyOnAction, self).post_put()
        for user in User.get(self.parent().invited_user_ids):
            user_channels = UserChannel.get_all_for_user(user)
            message = json.dumps({"type": "addparty", "party": self.parent().for_api_use()}, default=util.json_default_handler) 
            for user_channel in user_channels:
                user_channel.send_message(message)

class PartyOffAction(PartyAction):
    def post_put(self):
        super(PartyOffAction, self).post_put()
        for user in User.get(self.parent().invited_user_ids):
            user_channels = UserChannel.get_all_for_user(user)
            message = json.dumps({"type": "removeparty", "party": self.parent().for_api_use()}, default=util.json_default_handler)
            for user_channel in user_channels:
                user_channel.send_message(message)

@hooked_class
class UserChannel(db.Model):
    created = db.DateTimeProperty(auto_now_add = True)
    modified = db.DateTimeProperty(auto_now = True)
    
    @classmethod
    def get_or_init_for_user_and_channel_id(cls, user, channel_id):
        return cls.get_or_insert(channel_id, parent = user)

    @classmethod
    def get_all_for_user(cls, user):
        user_channels = cls.all().ancestor(user)
        return user_channels

    def on_disconnect(self):
        self.delete()

    def get_channel_id(self):
        return str(self.key().id_or_name())

    def get_token(self):
        self.put() # will update the modified field
        return channel.create_channel(self.get_channel_id())

    def send_message(self, message):
        channel.send_message(self.get_channel_id(), message)

@hooked_class
class PartyListener(db.Model):
    user_channel = db.ReferenceProperty(reference_class=UserChannel)
    created = db.DateTimeProperty(auto_now_add = True)

    @classmethod
    def addListener(cls, party, user_channel):
        cls.get_or_insert(user_channel.key().id_or_name(), parent=party, user_channel = user_channel)

    @classmethod
    def removeListener(cls, party, user_channel):
        listener = cls.get_by_key_name(user_channel.key().id_or_name(), parent=party)
        if listener:
            cls.delete(listener)

    @classmethod
    def getUserChannelsForParty(cls, party):
        return [partylistener.user_channel for partylistener in cls.all().ancestor(party)]
