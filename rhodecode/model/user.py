# -*- coding: utf-8 -*-
"""
    rhodecode.model.user
    ~~~~~~~~~~~~~~~~~~~~

    users model for RhodeCode

    :created_on: Apr 9, 2010
    :author: marcink
    :copyright: (C) 2010-2012 Marcin Kuzminski <marcin@python-works.com>
    :license: GPLv3, see COPYING for more details.
"""
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import logging
import traceback
import itertools
import collections
import functools
from pylons import url
from pylons.i18n.translation import _

from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import joinedload

from rhodecode.lib.utils2 import safe_unicode, generate_api_key
from rhodecode.lib.caching_query import FromCache
from rhodecode.model import BaseModel
from rhodecode.model.db import User, UserRepoToPerm, Repository, Permission, \
    UserToPerm, UsersGroupRepoToPerm, UsersGroupToPerm, UsersGroupMember, \
    Notification, RepoGroup, UserRepoGroupToPerm, UsersGroupRepoGroupToPerm, \
    UserEmailMap
from rhodecode.lib.exceptions import DefaultUserException, \
    UserOwnsReposException


log = logging.getLogger(__name__)

PERM_WEIGHTS = Permission.PERM_WEIGHTS


class UserModel(BaseModel):
    cls = User

    def get(self, user_id, cache=False):
        user = self.sa.query(User)
        if cache:
            user = user.options(FromCache("sql_cache_short",
                                          "get_user_%s" % user_id))
        return user.get(user_id)

    def get_user(self, user):
        return self._get_user(user)

    def get_by_username(self, username, cache=False, case_insensitive=False):

        if case_insensitive:
            user = self.sa.query(User).filter(User.username.ilike(username))
        else:
            user = self.sa.query(User)\
                .filter(User.username == username)
        if cache:
            user = user.options(FromCache("sql_cache_short",
                                          "get_user_%s" % username))
        return user.scalar()

    def get_by_email(self, email, cache=False, case_insensitive=False):
        return User.get_by_email(email, case_insensitive, cache)

    def get_by_api_key(self, api_key, cache=False):
        return User.get_by_api_key(api_key, cache)

    def create(self, form_data):
        from rhodecode.lib.auth import get_crypt_password
        try:
            new_user = User()
            for k, v in form_data.items():
                if k == 'password':
                    v = get_crypt_password(v)
                if k == 'firstname':
                    k = 'name'
                setattr(new_user, k, v)

            new_user.api_key = generate_api_key(form_data['username'])
            self.sa.add(new_user)
            return new_user
        except:
            log.error(traceback.format_exc())
            raise

    def create_or_update(self, username, password, email, firstname='',
                         lastname='', active=True, admin=False, ldap_dn=None):
        """
        Creates a new instance if not found, or updates current one

        :param username:
        :param password:
        :param email:
        :param active:
        :param firstname:
        :param lastname:
        :param active:
        :param admin:
        :param ldap_dn:
        """

        from rhodecode.lib.auth import get_crypt_password

        log.debug('Checking for %s account in RhodeCode database' % username)
        user = User.get_by_username(username, case_insensitive=True)
        if user is None:
            log.debug('creating new user %s' % username)
            new_user = User()
            edit = False
        else:
            log.debug('updating user %s' % username)
            new_user = user
            edit = True

        try:
            new_user.username = username
            new_user.admin = admin
            # set password only if creating an user or password is changed
            if edit is False or user.password != password:
                new_user.password = get_crypt_password(password)
                new_user.api_key = generate_api_key(username)
            new_user.email = email
            new_user.active = active
            new_user.ldap_dn = safe_unicode(ldap_dn) if ldap_dn else None
            new_user.name = firstname
            new_user.lastname = lastname
            self.sa.add(new_user)
            return new_user
        except (DatabaseError,):
            log.error(traceback.format_exc())
            raise

    def create_for_container_auth(self, username, attrs):
        """
        Creates the given user if it's not already in the database

        :param username:
        :param attrs:
        """
        if self.get_by_username(username, case_insensitive=True) is None:

            # autogenerate email for container account without one
            generate_email = lambda usr: '%s@container_auth.account' % usr

            try:
                new_user = User()
                new_user.username = username
                new_user.password = None
                new_user.api_key = generate_api_key(username)
                new_user.email = attrs['email']
                new_user.active = attrs.get('active', True)
                new_user.name = attrs['name'] or generate_email(username)
                new_user.lastname = attrs['lastname']

                self.sa.add(new_user)
                return new_user
            except (DatabaseError,):
                log.error(traceback.format_exc())
                self.sa.rollback()
                raise
        log.debug('User %s already exists. Skipping creation of account'
                  ' for container auth.', username)
        return None

    def create_ldap(self, username, password, user_dn, attrs):
        """
        Checks if user is in database, if not creates this user marked
        as ldap user

        :param username:
        :param password:
        :param user_dn:
        :param attrs:
        """
        from rhodecode.lib.auth import get_crypt_password
        log.debug('Checking for such ldap account in RhodeCode database')
        if self.get_by_username(username, case_insensitive=True) is None:

            # autogenerate email for ldap account without one
            generate_email = lambda usr: '%s@ldap.account' % usr

            try:
                new_user = User()
                username = username.lower()
                # add ldap account always lowercase
                new_user.username = username
                new_user.password = get_crypt_password(password)
                new_user.api_key = generate_api_key(username)
                new_user.email = attrs['email'] or generate_email(username)
                new_user.active = attrs.get('active', True)
                new_user.ldap_dn = safe_unicode(user_dn)
                new_user.name = attrs['name']
                new_user.lastname = attrs['lastname']

                self.sa.add(new_user)
                return new_user
            except (DatabaseError,):
                log.error(traceback.format_exc())
                self.sa.rollback()
                raise
        log.debug('this %s user exists skipping creation of ldap account',
                  username)
        return None

    def create_registration(self, form_data):
        from rhodecode.model.notification import NotificationModel

        try:
            form_data['admin'] = False
            new_user = self.create(form_data)

            self.sa.add(new_user)
            self.sa.flush()

            # notification to admins
            subject = _('new user registration')
            body = ('New user registration\n'
                    '---------------------\n'
                    '- Username: %s\n'
                    '- Full Name: %s\n'
                    '- Email: %s\n')
            body = body % (new_user.username, new_user.full_name,
                           new_user.email)
            edit_url = url('edit_user', id=new_user.user_id, qualified=True)
            kw = {'registered_user_url': edit_url}
            NotificationModel().create(created_by=new_user, subject=subject,
                                       body=body, recipients=None,
                                       type_=Notification.TYPE_REGISTRATION,
                                       email_kwargs=kw)

        except:
            log.error(traceback.format_exc())
            raise

    def update(self, user_id, form_data, skip_attrs=[]):
        from rhodecode.lib.auth import get_crypt_password
        try:
            user = self.get(user_id, cache=False)
            if user.username == 'default':
                raise DefaultUserException(
                                _("You can't Edit this user since it's"
                                  " crucial for entire application"))

            for k, v in form_data.items():
                if k in skip_attrs:
                    continue
                if k == 'new_password' and v:
                    user.password = get_crypt_password(v)
                    user.api_key = generate_api_key(user.username)
                else:
                    if k == 'firstname':
                        k = 'name'
                    setattr(user, k, v)
            self.sa.add(user)
        except:
            log.error(traceback.format_exc())
            raise

    def update_user(self, user, **kwargs):
        from rhodecode.lib.auth import get_crypt_password
        try:
            user = self._get_user(user)
            if user.username == 'default':
                raise DefaultUserException(
                    _("You can't Edit this user since it's"
                      " crucial for entire application")
                )

            for k, v in kwargs.items():
                if k == 'password' and v:
                    v = get_crypt_password(v)
                    user.api_key = generate_api_key(user.username)

                setattr(user, k, v)
            self.sa.add(user)
            return user
        except:
            log.error(traceback.format_exc())
            raise

    def update_my_account(self, user_id, form_data):
        from rhodecode.lib.auth import get_crypt_password
        try:
            user = self.get(user_id, cache=False)
            if user.username == 'default':
                raise DefaultUserException(
                    _("You can't Edit this user since it's"
                      " crucial for entire application")
                )
            for k, v in form_data.items():
                if k == 'new_password' and v:
                    user.password = get_crypt_password(v)
                    user.api_key = generate_api_key(user.username)
                else:
                    if k == 'firstname':
                        k = 'name'
                    if k not in ['admin', 'active']:
                        setattr(user, k, v)

            self.sa.add(user)
        except:
            log.error(traceback.format_exc())
            raise

    def delete(self, user):
        user = self._get_user(user)

        try:
            if user.username == 'default':
                raise DefaultUserException(
                    _(u"You can't remove this user since it's"
                      " crucial for entire application")
                )
            if user.repositories:
                repos = [x.repo_name for x in user.repositories]
                raise UserOwnsReposException(
                    _(u'user "%s" still owns %s repositories and cannot be '
                      'removed. Switch owners or remove those repositories. %s')
                    % (user.username, len(repos), ', '.join(repos))
                )
            self.sa.delete(user)
        except:
            log.error(traceback.format_exc())
            raise

    def reset_password_link(self, data):
        from rhodecode.lib.celerylib import tasks, run_task
        run_task(tasks.send_password_link, data['email'])

    def reset_password(self, data):
        from rhodecode.lib.celerylib import tasks, run_task
        run_task(tasks.reset_user_password, data['email'])

    def fill_data(self, auth_user, user_id=None, api_key=None):
        """
        Fetches auth_user by user_id,or api_key if present.
        Fills auth_user attributes with those taken from database.
        Additionally set's is_authenitated if lookup fails
        present in database

        :param auth_user: instance of user to set attributes
        :param user_id: user id to fetch by
        :param api_key: api key to fetch by
        """
        if user_id is None and api_key is None:
            raise Exception('You need to pass user_id or api_key')

        try:
            if api_key:
                dbuser = self.get_by_api_key(api_key)
            else:
                dbuser = self.get(user_id)

            if dbuser is not None and dbuser.active:
                log.debug('filling %s data' % dbuser)
                for k, v in dbuser.get_dict().items():
                    setattr(auth_user, k, v)
            else:
                return False

        except:
            log.error(traceback.format_exc())
            auth_user.is_authenticated = False
            return False

        return True

    def fill_perms(self, user, explicit=True, algo='higherwin'):
        """
        Fills user permission attribute with permissions taken from database
        works for permissions given for repositories, and for permissions that
        are granted to groups

        :param user: user instance to fill his perms
        :param explicit: In case there are permissions both for user and a group
            that user is part of, explicit flag will defiine if user will
            explicitly override permissions from group, if it's False it will
            make decision based on the algo
        :param algo: algorithm to decide what permission should be choose if
            it's multiple defined, eg user in two different groups. It also
            decides if explicit flag is turned off how to specify the permission
            for case when user is in a group + have defined separate permission
        """
        RK = 'repositories'
        GK = 'repositories_groups'
        GLOBAL = 'global'
        user.permissions[RK] = {}
        user.permissions[GK] = {}
        user.permissions[GLOBAL] = set()

        def _choose_perm(new_perm, cur_perm):
            new_perm_val = PERM_WEIGHTS[new_perm]
            cur_perm_val = PERM_WEIGHTS[cur_perm]
            if algo == 'higherwin':
                if new_perm_val > cur_perm_val:
                    return new_perm
                return cur_perm
            elif algo == 'lowerwin':
                if new_perm_val < cur_perm_val:
                    return new_perm
                return cur_perm

        #======================================================================
        # fetch default permissions
        #======================================================================
        default_user = User.get_by_username('default', cache=True)
        default_user_id = default_user.user_id

        default_repo_perms = Permission.get_default_perms(default_user_id)
        default_repo_groups_perms = Permission.get_default_group_perms(default_user_id)

        if user.is_admin:
            #==================================================================
            # admin user have all default rights for repositories
            # and groups set to admin
            #==================================================================
            user.permissions[GLOBAL].add('hg.admin')

            # repositories
            for perm in default_repo_perms:
                r_k = perm.UserRepoToPerm.repository.repo_name
                p = 'repository.admin'
                user.permissions[RK][r_k] = p

            # repositories groups
            for perm in default_repo_groups_perms:
                rg_k = perm.UserRepoGroupToPerm.group.group_name
                p = 'group.admin'
                user.permissions[GK][rg_k] = p
            return user

        #==================================================================
        # SET DEFAULTS GLOBAL, REPOS, REPOS GROUPS
        #==================================================================
        uid = user.user_id

        # default global permissions taken fron the default user
        default_global_perms = self.sa.query(UserToPerm)\
            .filter(UserToPerm.user_id == default_user_id)

        for perm in default_global_perms:
            user.permissions[GLOBAL].add(perm.permission.permission_name)

        # defaults for repositories, taken from default user
        for perm in default_repo_perms:
            r_k = perm.UserRepoToPerm.repository.repo_name
            if perm.Repository.private and not (perm.Repository.user_id == uid):
                # disable defaults for private repos,
                p = 'repository.none'
            elif perm.Repository.user_id == uid:
                # set admin if owner
                p = 'repository.admin'
            else:
                p = perm.Permission.permission_name

            user.permissions[RK][r_k] = p

        # defaults for repositories groups taken from default user permission
        # on given group
        for perm in default_repo_groups_perms:
            rg_k = perm.UserRepoGroupToPerm.group.group_name
            p = perm.Permission.permission_name
            user.permissions[GK][rg_k] = p

        #======================================================================
        # !! OVERRIDE GLOBALS !! with user permissions if any found
        #======================================================================
        # those can be configured from groups or users explicitly
        _configurable = set(['hg.fork.none', 'hg.fork.repository',
                             'hg.create.none', 'hg.create.repository'])

        # USER GROUPS comes first
        # users group global permissions
        user_perms_from_users_groups = self.sa.query(UsersGroupToPerm)\
            .options(joinedload(UsersGroupToPerm.permission))\
            .join((UsersGroupMember, UsersGroupToPerm.users_group_id ==
                   UsersGroupMember.users_group_id))\
            .filter(UsersGroupMember.user_id == uid)\
            .order_by(UsersGroupToPerm.users_group_id)\
            .all()
        #need to group here by groups since user can be in more than one group
        _grouped = [[x, list(y)] for x, y in
                    itertools.groupby(user_perms_from_users_groups,
                                      lambda x:x.users_group)]
        for gr, perms in _grouped:
            # since user can be in multiple groups iterate over them and
            # select the lowest permissions first (more explicit)
            ##TODO: do this^^
            if not gr.inherit_default_permissions:
                # NEED TO IGNORE all configurable permissions and
                # replace them with explicitly set
                user.permissions[GLOBAL] = user.permissions[GLOBAL]\
                                                .difference(_configurable)
            for perm in perms:
                user.permissions[GLOBAL].add(perm.permission.permission_name)

        # user specific global permissions
        user_perms = self.sa.query(UserToPerm)\
                .options(joinedload(UserToPerm.permission))\
                .filter(UserToPerm.user_id == uid).all()

        if not user.inherit_default_permissions:
            # NEED TO IGNORE all configurable permissions and
            # replace them with explicitly set
            user.permissions[GLOBAL] = user.permissions[GLOBAL]\
                                            .difference(_configurable)

            for perm in user_perms:
                user.permissions[GLOBAL].add(perm.permission.permission_name)

        #======================================================================
        # !! PERMISSIONS FOR REPOSITORIES !!
        #======================================================================
        #======================================================================
        # check if user is part of user groups for this repository and
        # fill in his permission from it. _choose_perm decides of which
        # permission should be selected based on selected method
        #======================================================================

        # users group for repositories permissions
        user_repo_perms_from_users_groups = \
         self.sa.query(UsersGroupRepoToPerm, Permission, Repository,)\
            .join((Repository, UsersGroupRepoToPerm.repository_id ==
                   Repository.repo_id))\
            .join((Permission, UsersGroupRepoToPerm.permission_id ==
                   Permission.permission_id))\
            .join((UsersGroupMember, UsersGroupRepoToPerm.users_group_id ==
                   UsersGroupMember.users_group_id))\
            .filter(UsersGroupMember.user_id == uid)\
            .all()

        multiple_counter = collections.defaultdict(int)
        for perm in user_repo_perms_from_users_groups:
            r_k = perm.UsersGroupRepoToPerm.repository.repo_name
            multiple_counter[r_k] += 1
            p = perm.Permission.permission_name
            cur_perm = user.permissions[RK][r_k]

            if perm.Repository.user_id == uid:
                # set admin if owner
                p = 'repository.admin'
            else:
                if multiple_counter[r_k] > 1:
                    p = _choose_perm(p, cur_perm)
            user.permissions[RK][r_k] = p

        # user explicit permissions for repositories, overrides any specified
        # by the group permission
        user_repo_perms = \
         self.sa.query(UserRepoToPerm, Permission, Repository)\
            .join((Repository, UserRepoToPerm.repository_id ==
                   Repository.repo_id))\
            .join((Permission, UserRepoToPerm.permission_id ==
                   Permission.permission_id))\
            .filter(UserRepoToPerm.user_id == uid)\
            .all()

        for perm in user_repo_perms:
            r_k = perm.UserRepoToPerm.repository.repo_name
            cur_perm = user.permissions[RK][r_k]
            # set admin if owner
            if perm.Repository.user_id == uid:
                p = 'repository.admin'
            else:
                p = perm.Permission.permission_name
                if not explicit:
                    p = _choose_perm(p, cur_perm)
            user.permissions[RK][r_k] = p

        #======================================================================
        # !! PERMISSIONS FOR REPOSITORIES GROUPS !!
        #======================================================================
        #======================================================================
        # check if user is part of user groups for this repository groups and
        # fill in his permission from it. _choose_perm decides of which
        # permission should be selected based on selected method
        #======================================================================
        # users group for repo groups permissions
        user_repo_group_perms_from_users_groups = \
         self.sa.query(UsersGroupRepoGroupToPerm, Permission, RepoGroup)\
         .join((RepoGroup, UsersGroupRepoGroupToPerm.group_id == RepoGroup.group_id))\
         .join((Permission, UsersGroupRepoGroupToPerm.permission_id
                == Permission.permission_id))\
         .join((UsersGroupMember, UsersGroupRepoGroupToPerm.users_group_id
                == UsersGroupMember.users_group_id))\
         .filter(UsersGroupMember.user_id == uid)\
         .all()

        multiple_counter = collections.defaultdict(int)
        for perm in user_repo_group_perms_from_users_groups:
            g_k = perm.UsersGroupRepoGroupToPerm.group.group_name
            multiple_counter[g_k] += 1
            p = perm.Permission.permission_name
            cur_perm = user.permissions[GK][g_k]
            if multiple_counter[g_k] > 1:
                p = _choose_perm(p, cur_perm)
            user.permissions[GK][g_k] = p

        # user explicit permissions for repository groups
        user_repo_groups_perms = \
         self.sa.query(UserRepoGroupToPerm, Permission, RepoGroup)\
         .join((RepoGroup, UserRepoGroupToPerm.group_id == RepoGroup.group_id))\
         .join((Permission, UserRepoGroupToPerm.permission_id
                == Permission.permission_id))\
         .filter(UserRepoGroupToPerm.user_id == uid)\
         .all()

        for perm in user_repo_groups_perms:
            rg_k = perm.UserRepoGroupToPerm.group.group_name
            p = perm.Permission.permission_name
            cur_perm = user.permissions[GK][rg_k]
            if not explicit:
                p = _choose_perm(p, cur_perm)
            user.permissions[GK][rg_k] = p

        return user

    def has_perm(self, user, perm):
        perm = self._get_perm(perm)
        user = self._get_user(user)

        return UserToPerm.query().filter(UserToPerm.user == user)\
            .filter(UserToPerm.permission == perm).scalar() is not None

    def grant_perm(self, user, perm):
        """
        Grant user global permissions

        :param user:
        :param perm:
        """
        user = self._get_user(user)
        perm = self._get_perm(perm)
        # if this permission is already granted skip it
        _perm = UserToPerm.query()\
            .filter(UserToPerm.user == user)\
            .filter(UserToPerm.permission == perm)\
            .scalar()
        if _perm:
            return
        new = UserToPerm()
        new.user = user
        new.permission = perm
        self.sa.add(new)

    def revoke_perm(self, user, perm):
        """
        Revoke users global permissions

        :param user:
        :param perm:
        """
        user = self._get_user(user)
        perm = self._get_perm(perm)

        obj = UserToPerm.query()\
                .filter(UserToPerm.user == user)\
                .filter(UserToPerm.permission == perm)\
                .scalar()
        if obj:
            self.sa.delete(obj)

    def add_extra_email(self, user, email):
        """
        Adds email address to UserEmailMap

        :param user:
        :param email:
        """
        from rhodecode.model import forms
        form = forms.UserExtraEmailForm()()
        data = form.to_python(dict(email=email))
        user = self._get_user(user)

        obj = UserEmailMap()
        obj.user = user
        obj.email = data['email']
        self.sa.add(obj)
        return obj

    def delete_extra_email(self, user, email_id):
        """
        Removes email address from UserEmailMap

        :param user:
        :param email_id:
        """
        user = self._get_user(user)
        obj = UserEmailMap.query().get(email_id)
        if obj:
            self.sa.delete(obj)
